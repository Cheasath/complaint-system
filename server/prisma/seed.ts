import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  await prisma.feedback.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.statusHistory.deleteMany()
  await prisma.complaint.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()
  await prisma.category.deleteMany()

  const password = await bcrypt.hash('Password123!', 10)
  const departments = await Promise.all(['Infrastructure', 'Electrical', 'Hostel', 'IT Services', 'Sanitation'].map(name => prisma.department.create({ data: { name } })))
  const categories = await Promise.all(['Infrastructure', 'Electrical', 'Plumbing', 'Hostel', 'Classroom', 'Laboratory', 'Internet/Wi-Fi', 'Sanitation', 'Transportation', 'Other'].map(name => prisma.category.create({ data: { name } })))

  const admin = await prisma.user.create({ data: { name: 'Alex Morgan', email: 'admin@campus.edu', password, role: 'ADMIN' } })
  const student = await prisma.user.create({ data: { name: 'Jordan Lee', email: 'student@campus.edu', password, role: 'STUDENT' } })

  const samples = [
    ['Air conditioning unit leaking', 'Water is dripping above desk 18 in Lecture Hall B.', 'Lecture Hall B', 'HIGH', 'SUBMITTED', 'Infrastructure'],
    ['Library Wi-Fi intermittently drops', 'Wireless network disconnects every few minutes on the east side.', 'Central Library', 'MEDIUM', 'IN_PROGRESS', 'Internet/Wi-Fi'],
    ['Corridor light flickering', 'Two fluorescent lights continue to flicker after hours.', 'Science Block - 2F', 'MEDIUM', 'ASSIGNED', 'Electrical'],
    ['Hostel tap not shutting off', 'Tap in room 204 continues leaking and wasting water.', 'North Hostel - 204', 'HIGH', 'UNDER_REVIEW', 'Plumbing'],
    ['Laboratory bench damaged', 'The front bench surface is cracked and unsafe.', 'Physics Lab 1', 'CRITICAL', 'RESOLVED', 'Laboratory'],
  ]

  for (let i = 0; i < samples.length; i++) {
    const [title, description, location, priority, status, categoryName] = samples[i]
    const category = categories.find(item => item.name === categoryName)!
    const department = departments[i % departments.length]
    const complaint = await prisma.complaint.create({
      data: {
        reference: `CMP-${2026}${String(i + 1).padStart(4, '0')}`,
        title, description, location, priority, status,
        categoryId: category.id,
        studentId: student.id,
        departmentId: status === 'SUBMITTED' ? null : department.id,
        dueDate: new Date(Date.now() + (i + 1) * 86400000),
      },
    })
    await prisma.statusHistory.create({ data: { complaintId: complaint.id, newStatus: 'SUBMITTED', updatedById: student.id } })
    if (status !== 'SUBMITTED') await prisma.statusHistory.create({ data: { complaintId: complaint.id, previousStatus: 'SUBMITTED', newStatus: status, remarks: 'Automatically seeded for demo', updatedById: admin.id } })
  }

  console.log('Seed complete')
}

main().finally(() => prisma.$disconnect())
