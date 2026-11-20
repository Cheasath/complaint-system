import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const app = express()
const prisma = new PrismaClient()
const port = Number(process.env.PORT || 4000)
const jwtSecret = process.env.JWT_SECRET || 'change-this-in-production'

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

const uploadDir = path.join(process.cwd(), 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })
app.use('/uploads', express.static(uploadDir))
const upload = multer({ storage: multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) })

type AuthRequest = Request & { user?: { id: string; role: string } }

function signUser(user: { id: string; role: string }) {
  return jwt.sign(user, jwtSecret, { expiresIn: '8h' })
}

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.campus_session
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try { req.user = jwt.verify(token, jwtSecret) as { id: string; role: string }; next() } catch { res.status(401).json({ message: 'Session expired' }) }
}

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to perform this action' })
    next()
  }
}

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/auth/register', async (req, res) => {
  const schema = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(72) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ message: parsed.error.issues[0].message })
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (existing) return res.status(409).json({ message: 'An account with this email already exists' })
  const user = await prisma.user.create({ data: { name: parsed.data.name, email: parsed.data.email.toLowerCase(), password: await bcrypt.hash(parsed.data.password, 12), role: 'STUDENT' } })
  res.cookie('campus_session', signUser({ id: user.id, role: user.role }), cookieOptions)
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

app.post('/api/auth/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ message: 'Enter a valid email and password' })
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.password))) return res.status(401).json({ message: 'Invalid email or password' })
  res.cookie('campus_session', signUser({ id: user.id, role: user.role }), cookieOptions)
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

app.post('/api/auth/logout', (_req, res) => { res.clearCookie('campus_session'); res.json({ success: true }) })

app.get('/api/auth/me', auth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true, active: true } })
  res.json({ user })
})

app.get('/api/categories', auth, async (_req, res) => res.json({ categories: await prisma.category.findMany({ orderBy: { name: 'asc' } }) }))
app.get('/api/departments', auth, async (_req, res) => res.json({ departments: await prisma.department.findMany({ orderBy: { name: 'asc' } }) }))

app.get('/api/dashboard/student', auth, requireRole('STUDENT', 'ADMIN'), async (req: AuthRequest, res) => {
  const studentId = req.user!.role === 'ADMIN' ? undefined : req.user!.id
  const base = studentId ? { studentId } : {}
  const [total, pending, inProgress, resolved, rejected, recent] = await Promise.all([
    prisma.complaint.count({ where: base }),
    prisma.complaint.count({ where: { ...base, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED'] } } }),
    prisma.complaint.count({ where: { ...base, status: 'IN_PROGRESS' } }),
    prisma.complaint.count({ where: { ...base, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.complaint.count({ where: { ...base, status: 'REJECTED' } }),
    prisma.complaint.findMany({ where: base, include: { category: true, department: true }, orderBy: { updatedAt: 'desc' }, take: 6 }),
  ])
  res.json({ stats: { total, pending, inProgress, resolved, rejected }, recent })
})

app.get('/api/complaints', auth, async (req: AuthRequest, res) => {
  const { search, status, priority, category, page = '1' } = req.query
  const pageNumber = Math.max(Number(page), 1)
  const pageSize = 10
  const where: any = req.user!.role === 'STUDENT' ? { studentId: req.user!.id } : {}
  if (status) where.status = status
  if (priority) where.priority = priority
  if (category) where.category = { name: category }
  if (search) where.OR = [{ reference: { contains: String(search), mode: 'insensitive' } }, { title: { contains: String(search), mode: 'insensitive' } }]
  const [items, total] = await Promise.all([prisma.complaint.findMany({ where, include: { category: true, department: true, student: { select: { name: true, email: true } } }, orderBy: { updatedAt: 'desc' }, skip: (pageNumber - 1) * pageSize, take: pageSize }), prisma.complaint.count({ where })])
  res.json({ items, total, page: pageNumber, pageSize })
})

app.get('/api/complaints/:id', auth, async (req: AuthRequest, res) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: String(req.params.id) }, include: { category: true, department: true, student: { select: { id: true, name: true, email: true } }, comments: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } }, history: { include: { updatedBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }, attachments: true, feedback: true } })
  if (!complaint) return res.status(404).json({ message: 'Complaint not found' })
  if (req.user!.role === 'STUDENT' && complaint.studentId !== req.user!.id) return res.status(403).json({ message: 'You do not have permission to view this complaint' })
  res.json({ complaint })
})

app.post('/api/complaints', auth, requireRole('STUDENT', 'ADMIN'), upload.array('attachments', 4), async (req: AuthRequest, res) => {
  const schema = z.object({ title: z.string().min(5).max(120), description: z.string().min(20).max(3000), categoryId: z.string().min(1), location: z.string().min(2).max(160), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ message: parsed.error.issues[0].message })
  const count = await prisma.complaint.count()
  const complaint = await prisma.complaint.create({ data: { reference: `CMP-${2026}${String(count + 1).padStart(4, '0')}`, ...parsed.data, studentId: req.user!.id, dueDate: new Date(Date.now() + (parsed.data.priority === 'CRITICAL' ? 2 : parsed.data.priority === 'HIGH' ? 3 : 7) * 86400000), attachments: { create: ((req.files as Express.Multer.File[]) || []).map(file => ({ fileName: file.originalname, fileType: file.mimetype, fileUrl: `/uploads/${file.filename}` })) } }, include: { category: true, attachments: true } })
  await prisma.statusHistory.create({ data: { complaintId: complaint.id, newStatus: 'SUBMITTED', updatedById: req.user!.id } })
  res.status(201).json({ complaint })
})

app.patch('/api/complaints/:id/status', auth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({ status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED', 'REOPENED']), departmentId: z.string().optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(), remarks: z.string().max(1000).optional(), resolution: z.string().max(3000).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ message: parsed.error.issues[0].message })
  const current = await prisma.complaint.findUnique({ where: { id: String(req.params.id) } })
  if (!current) return res.status(404).json({ message: 'Complaint not found' })
  const complaint = await prisma.complaint.update({ where: { id: String(req.params.id) }, data: { status: parsed.data.status, departmentId: parsed.data.departmentId, priority: parsed.data.priority, resolution: parsed.data.resolution }, include: { category: true, department: true } })
  await prisma.statusHistory.create({ data: { complaintId: complaint.id, previousStatus: current.status, newStatus: parsed.data.status, remarks: parsed.data.remarks, updatedById: req.user!.id } })
  res.json({ complaint })
})

app.post('/api/complaints/:id/comments', auth, async (req: AuthRequest, res) => {
  const schema = z.object({ body: z.string().min(1).max(2000), internal: z.boolean().optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ message: parsed.error.issues[0].message })
  if (parsed.data.internal && req.user!.role !== 'ADMIN') return res.status(403).json({ message: 'Only administrators can add internal notes' })
  const comment = await prisma.comment.create({ data: { complaintId: String(req.params.id), authorId: req.user!.id, body: parsed.data.body, internal: parsed.data.internal || false }, include: { author: { select: { id: true, name: true, role: true } } } })
  res.status(201).json({ comment })
})

app.post('/api/complaints/:id/feedback', auth, requireRole('STUDENT'), async (req: AuthRequest, res) => {
  const schema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ message: 'Rating must be between 1 and 5' })
  const complaint = await prisma.complaint.findUnique({ where: { id: String(req.params.id) } })
  if (!complaint || complaint.studentId !== req.user!.id) return res.status(403).json({ message: 'You cannot submit feedback for this complaint' })
  const feedback = await prisma.feedback.upsert({ where: { complaintId: String(req.params.id) }, create: { complaintId: String(req.params.id), rating: parsed.data.rating, comment: parsed.data.comment }, update: { rating: parsed.data.rating, comment: parsed.data.comment } })
  res.json({ feedback })
})

app.get('/api/analytics', auth, requireRole('ADMIN'), async (_req, res) => {
  const [total, submitted, inProgress, resolved, rejected, overdue, categories, departments] = await Promise.all([
    prisma.complaint.count(), prisma.complaint.count({ where: { status: 'SUBMITTED' } }), prisma.complaint.count({ where: { status: 'IN_PROGRESS' } }), prisma.complaint.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }), prisma.complaint.count({ where: { status: 'REJECTED' } }), prisma.complaint.count({ where: { dueDate: { lt: new Date() }, status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] } } }),
    prisma.category.findMany({ include: { _count: { select: { complaints: true } } }, orderBy: { name: 'asc' } }), prisma.department.findMany({ include: { _count: { select: { complaints: true } } }, orderBy: { name: 'asc' } }),
  ])
  res.json({ stats: { total, submitted, inProgress, resolved, rejected, overdue }, categoryData: categories.map(c => ({ name: c.name, value: c._count.complaints })), departmentData: departments.map(d => ({ name: d.name, value: d._count.complaints })) })
})

app.get('/api/users', auth, requireRole('ADMIN'), async (_req, res) => res.json({ users: await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, departmentId: true, createdAt: true }, orderBy: { createdAt: 'desc' } }) }))

app.patch('/api/users/:id', auth, requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({ active: z.boolean().optional(), role: z.enum(['STUDENT', 'ADMIN']).optional(), departmentId: z.string().nullable().optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ message: 'Invalid user update' })
  const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: parsed.data, select: { id: true, name: true, email: true, role: true, active: true, departmentId: true } })
  res.json({ user })
})

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})

app.listen(port, () => console.log(`Campus API listening on http://localhost:${port}`))
