import { useEffect, useState } from 'react'
import { BarChart3, Building2, ClipboardList, LayoutDashboard, LogOut, Moon, Plus, Search, Sun, Users } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const API = 'http://localhost:4000/api'

type User = { id: string; name: string; email: string; role: 'STUDENT' | 'ADMIN' }
type Complaint = { id: string; reference: string; title: string; status: string; priority: string; location: string; createdAt: string; updatedAt: string; category?: { name: string }; department?: { name: string } }

async function api(path: string, options: RequestInit = {}) {
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Request failed')
  return data
}

const statusClass = (status: string) => `status status-${status.toLowerCase().replaceAll('_', '-')}`

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [view, setView] = useState('overview')
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0, rejected: 0 })
  const [analytics, setAnalytics] = useState<{ categoryData: { name: string; value: number }[]; departmentData: { name: string; value: number }[]; stats: Record<string, number> }>({ categoryData: [], departmentData: [], stats: {} })
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dark, setDark] = useState(false)

  useEffect(() => { api('/auth/me').then(data => setUser(data.user)).catch(() => setUser(null)).finally(() => setChecking(false)) }, [])

  useEffect(() => {
    if (!user) return
    loadWorkspace()
  }, [user])

  async function loadWorkspace() {
    setLoading(true)
    setError('')
    try {
      const [complaintData, categoryData, departmentData] = await Promise.all([
        api('/complaints'), api('/categories'), api('/departments'),
      ])
      setComplaints(complaintData.items)
      setCategories(categoryData.categories)
      setDepartments(departmentData.departments)
      const dashboard = await api(user?.role === 'ADMIN' ? '/analytics' : '/dashboard/student')
      if (user?.role === 'ADMIN') { setAnalytics(dashboard); setStats({ total: dashboard.stats.total, pending: dashboard.stats.submitted, inProgress: dashboard.stats.inProgress, resolved: dashboard.stats.resolved, rejected: dashboard.stats.rejected }) ; setUsers((await api('/users')).users) }
      else setStats(dashboard.stats)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load workspace') }
    finally { setLoading(false) }
  }

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    try { const data = await api(`/auth/${authMode}`, { method: 'POST', body: JSON.stringify(body) }); setUser(data.user) } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed') }
  }

  if (checking) return <div className="loading-screen"><div className="spinner" /></div>

  if (!user) return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="brand-mark"><Building2 size={22} /><span>CampusDesk</span></div>
        <div className="auth-copy"><span className="eyebrow">SMART CAMPUS SERVICES</span><h1>One place to get campus issues resolved.</h1><p>Submit, track, and follow every campus service request with clear accountability.</p></div>
        <div className="auth-proof"><span>24/7</span><p>request visibility across campus</p></div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={handleAuth}>
          <div><span className="eyebrow">{authMode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</span><h2>{authMode === 'login' ? 'Sign in to CampusDesk' : 'Register for CampusDesk'}</h2></div>
          {authMode === 'register' && <label>Full name<input name="name" placeholder="Your name" required /></label>}
          {authMode === 'login' && <div className="demo-role-selector"><span>Demo login</span><button type="button" onClick={() => { const form = document.querySelector('.auth-card') as HTMLFormElement; const email = form?.elements.namedItem('email') as HTMLInputElement; const password = form?.elements.namedItem('password') as HTMLInputElement; if (email) email.value = 'student@campus.edu'; if (password) password.value = 'Password123!' }}>Student</button><button type="button" onClick={() => { const form = document.querySelector('.auth-card') as HTMLFormElement; const email = form?.elements.namedItem('email') as HTMLInputElement; const password = form?.elements.namedItem('password') as HTMLInputElement; if (email) email.value = 'admin@campus.edu'; if (password) password.value = 'Password123!' }}>Administrator</button></div>}
          <label>Email address<input name="email" type="email" defaultValue="student@campus.edu" placeholder="you@campus.edu" required /></label>
          <label>Password<input name="password" type="password" defaultValue="Password123!" placeholder="At least 8 characters" required /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button className="text-button" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError('') }}>{authMode === 'login' ? 'New to CampusDesk? Create account' : 'Already registered? Sign in'}</button>
          {authMode === 'login' && <p className="demo-hint">Demo: student@campus.edu or admin@campus.edu<br />Password: Password123!</p>}
        </form>
      </section>
    </main>
  )

  const nav = user.role === 'ADMIN'
    ? [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'complaints', label: 'Complaints', icon: ClipboardList }, { id: 'departments', label: 'Departments', icon: Building2 }, { id: 'users', label: 'Users', icon: Users }, { id: 'analytics', label: 'Analytics', icon: BarChart3 }]
    : [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'new', label: 'Submit complaint', icon: Plus }, { id: 'complaints', label: 'My complaints', icon: ClipboardList }]

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className="sidebar">
        <div className="brand-mark"><Building2 size={21} /><span>CampusDesk</span></div>
        <nav>{nav.map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.id)}><Icon size={18} /><span>{item.label}</span></button> })}</nav>
        <div className="sidebar-footer"><button className="nav-item" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}<span>{dark ? 'Light mode' : 'Dark mode'}</span></button><button className="nav-item" onClick={async () => { await api('/auth/logout', { method: 'POST' }); setUser(null) }}><LogOut size={18} /><span>Sign out</span></button></div>
      </aside>
      <main className="workspace">
        <header className="topbar"><div><span className="eyebrow">{user.role === 'ADMIN' ? 'ADMINISTRATION' : 'STUDENT PORTAL'}</span><h1>{view === 'overview' ? `Good morning, ${user.name.split(' ')[0]}` : nav.find(item => item.id === view)?.label}</h1></div><div className="profile"><div className="avatar">{user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div><div><strong>{user.name}</strong><span>{user.role === 'ADMIN' ? 'Administrator' : 'Student'}</span></div></div></header>
        {error && <div className="form-error workspace-error">{error}</div>}
        {loading && <div className="workspace-error">Loading workspace...</div>}
        {view === 'overview' && <Dashboard stats={stats} complaints={complaints} user={user} analytics={analytics} setView={setView} />}
        {view === 'new' && <ComplaintForm categories={categories} onCreated={async () => { await loadWorkspace(); setView('complaints') }} />}
        {view === 'complaints' && <ComplaintTable complaints={complaints} admin={user.role === 'ADMIN'} onUpdate={loadWorkspace} />}
        {view === 'analytics' && <Analytics analytics={analytics} />}
        {view === 'departments' && <Departments departments={departments} complaints={complaints} />}
        {view === 'users' && <UserTable users={users} onUpdate={loadWorkspace} />}
      </main>
    </div>
  )
}

function Dashboard({ stats, complaints, user, analytics, setView }: { stats: any; complaints: Complaint[]; user: User; analytics: any; setView: (view: string) => void }) {
  const cards = [{ label: 'Total complaints', value: stats.total, tone: 'blue' }, { label: 'Pending', value: stats.pending, tone: 'amber' }, { label: 'In progress', value: stats.inProgress, tone: 'violet' }, { label: 'Resolved', value: stats.resolved, tone: 'green' }, { label: 'Rejected', value: stats.rejected, tone: 'red' }]
  return <><section className="stats-grid">{cards.map(card => <article className="stat-card" key={card.label}><span className={`stat-dot ${card.tone}`} /><div><span>{card.label}</span><strong>{card.value}</strong></div></article>)}</section><section className="dashboard-grid"><article className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVITY</span><h2>Recent complaints</h2></div>{user.role === 'STUDENT' && <button className="primary-button small" onClick={() => setView('new')}><Plus size={16} />Submit complaint</button>}</div><div className="activity-list">{complaints.slice(0, 5).map(item => <div className="activity-row" key={item.id}><div className="activity-icon"><ClipboardList size={17} /></div><div className="activity-main"><strong>{item.title}</strong><span>{item.reference} · {item.category?.name}</span></div><span className={statusClass(item.status)}>{item.status.replaceAll('_', ' ')}</span></div>)}</div></article>{user.role === 'ADMIN' && <article className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">CATEGORIES</span><h2>Complaint volume</h2></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.categoryData.slice(0, 6)}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#3567d8" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></article>}</section></>
}

function ComplaintTable({ complaints, admin, onUpdate }: { complaints: Complaint[]; admin: boolean; onUpdate: () => void }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const filtered = complaints.filter(item => (statusFilter === 'ALL' || item.status === statusFilter) && (`${item.title} ${item.reference}`.toLowerCase().includes(query.toLowerCase())))
  async function updateStatus(item: Complaint, status: string) { await api(`/complaints/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); onUpdate() }
  return <section className="panel table-panel"><div className="table-toolbar"><label className="search-box"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search complaints" /></label><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>ALL</option>{['SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS','RESOLVED','REJECTED','CLOSED'].map(status => <option key={status}>{status}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>Complaint</th><th>Category</th><th>Priority</th><th>Status</th><th>Department</th>{admin && <th>Action</th>}</tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><strong>{item.title}</strong><span>{item.reference} · {item.location}</span></td><td>{item.category?.name || 'Other'}</td><td><span className={`priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span></td><td><span className={statusClass(item.status)}>{item.status.replaceAll('_', ' ')}</span></td><td>{item.department?.name || 'Unassigned'}</td>{admin && <td><select className="row-action" value={item.status} onChange={event => updateStatus(item, event.target.value)}>{['SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS','RESOLVED','REJECTED','CLOSED'].map(status => <option key={status}>{status}</option>)}</select></td>}</tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">No complaints match this view.</div>}</div></section>
}

function ComplaintForm({ categories, onCreated }: { categories: { id: string; name: string }[]; onCreated: () => void }) {
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget)
    try { await api('/complaints', { method: 'POST', body: form }); onCreated() } catch (err) { setError(err instanceof Error ? err.message : 'Submission failed') }
  }
  return <section className="panel form-panel"><div className="panel-heading"><div><span className="eyebrow">NEW REQUEST</span><h2>Submit a complaint</h2></div></div><form onSubmit={submit} className="complaint-form"><label>Complaint title<input name="title" required placeholder="Briefly describe the issue" /></label><label>Category<select name="categoryId" required><option value="">Select category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Location or building<input name="location" required placeholder="Building, room, or area" /></label><label>Priority<select name="priority" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label><label className="full-field">Detailed description<textarea name="description" required minLength={20} placeholder="Describe what happened, where, and when..." /></label><label className="full-field">Attachments<input name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple /></label>{error && <div className="form-error full-field">{error}</div>}<div className="form-actions full-field"><button type="button" className="secondary-button">Cancel</button><button className="primary-button" type="submit">Submit complaint</button></div></form></section>
}

function Analytics({ analytics }: { analytics: any }) {
  return <section className="analytics-grid"><article className="panel chart-panel large"><div className="panel-heading"><div><span className="eyebrow">DEPARTMENTS</span><h2>Workload by department</h2></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.departmentData}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#1d9a74" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">OPERATIONS</span><h2>Current workload</h2></div></div><div className="metric-list">{Object.entries(analytics.stats).map(([label, value]) => <div key={label}><span>{label.replaceAll('_', ' ')}</span><strong>{String(value)}</strong></div>)}</div></article></section>
}

function Departments({ departments, complaints }: { departments: { id: string; name: string }[]; complaints: Complaint[] }) {
  return <section className="department-grid">{departments.map(department => <article className="panel department-card" key={department.id}><div className="department-icon"><Building2 size={18} /></div><h2>{department.name}</h2><p>{complaints.filter(item => item.department?.name === department.name).length} active complaints</p><button className="secondary-button">View department</button></article>)}</section>
}

function UserTable({ users, onUpdate }: { users: User[]; onUpdate: () => void }) {
  async function toggle(user: User) { await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ active: !(user as any).active }) }); onUpdate() }
  return <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.name}</strong><span>{user.email}</span></td><td>{user.role}</td><td><span className={(user as any).active === false ? 'status status-rejected' : 'status status-resolved'}>{(user as any).active === false ? 'Inactive' : 'Active'}</span></td><td><button className="secondary-button" onClick={() => toggle(user)}>{(user as any).active === false ? 'Activate' : 'Deactivate'}</button></td></tr>)}</tbody></table></div></section>
}

export default App
