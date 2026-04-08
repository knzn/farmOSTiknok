'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminStats = {
  users: {
    total: number; trial: number; active: number; expired: number
    suspended: number; banned: number; newToday: number; newThisWeek: number
    trialEndingThisWeek: number; activeLastWeek: number
    neverLoggedIn: number; noSeasons: number
  }
  adoption: {
    usersWithSeasons: number; usersWithMarkings: number
    usersWithFinance: number; usersWithWorkers: number; usersWithExpenses: number
  }
  breeding: { totalSeasons: number; totalMatings: number; totalMarkingsGenerated: number }
  finance: { totalWorkers: number; totalExpenses: number; expenseByCat: { category: string; count: number }[] }
  dailyRegistrations: { date: string; count: number }[]
}

type Analytics = {
  platform: { android: number; iphone: number; desktop: number; other: number }
  loginMethod: { google: number; email: number }
  dailyLogins: { date: string; count: number }[]
}

type AdminUser = {
  _id: string; username: string; email: string; tiknokId: string | null
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended'
  subscriptionTier: 'free' | 'pro'; trialEndsAt: string | null; paidUntil: string | null
  isAdmin: boolean; isBanned: boolean; createdAt: string | null
}

type UsersResponse = { users: AdminUser[]; total: number; page: number; pages: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'active')    return { bg: 'bg-[#22C55E22]', text: 'text-[#22C55E]' }
  if (s === 'trial')     return { bg: 'bg-[#C8A84B22]', text: 'text-[#C8A84B]' }
  if (s === 'expired')   return { bg: 'bg-[#EF444422]', text: 'text-[#EF4444]' }
  if (s === 'suspended') return { bg: 'bg-[#A0A0A022]', text: 'text-[#A0A0A0]' }
  return { bg: 'bg-card', text: 'text-ink-3' }
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Ended'
  return `${diff}d left`
}

function fmtDate(d: string) {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

const CAT_LABEL: Record<string, string> = {
  feeds: 'Feeds', vitamins: 'Vitamins', medicines: 'Medicines',
  deworming: 'Deworming', workers_extra_budget: 'Workers Extra', miscellaneous: 'Misc',
}

const FILTERS = [
  { label: 'All', value: '' }, { label: 'Trial', value: 'trial' },
  { label: 'Active', value: 'active' }, { label: 'Expired', value: 'expired' },
  { label: 'Suspended', value: 'suspended' }, { label: 'Banned', value: 'banned' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, color, onClick, sub,
}: { label: string; value: number; color?: string; onClick?: () => void; sub?: string }) {
  return (
    <div
      onClick={onClick}
      className={`flex-1 bg-card border border-rim rounded-xl p-4 min-w-[100px] ${onClick ? 'cursor-pointer hover:border-accent/40 transition-colors' : ''}`}
    >
      <p className="text-2xl font-black" style={{ color: color ?? '#FFFFFF' }}>{value}</p>
      <p className="text-ink-3 text-xs mt-1 leading-tight">{label}</p>
      {sub && <p className="text-ink-3 text-[10px] mt-0.5">{sub}</p>}
      {onClick && <p className="text-accent text-[10px] mt-1 font-semibold">tap to see users →</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">{children}</p>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats]         = useState(null as AdminStats | null)
  const [analytics, setAnalytics] = useState(null as Analytics | null)
  const [users, setUsers]         = useState([] as AdminUser[])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [isAdmin, setIsAdmin]     = useState(null as boolean | null)

  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('')
  const [featureFilter, setFeatureFilter] = useState('')  // active feature drill-down
  const [featureLabel, setFeatureLabel]   = useState('')

  const loadUsers = useCallback(async (q = search, f = filter, feat = featureFilter) => {
    const params = new URLSearchParams()
    if (f)    params.set('status', f)
    if (q)    params.set('search', q)
    if (feat) params.set('feature', feat)
    const res = await apiRequest(`/admin/users?${params.toString()}`) as UsersResponse
    setUsers(res.users)
    setTotal(res.total)
  }, [search, filter, featureFilter])

  const load = useCallback(async () => {
    try {
      setError('')
      const me = await apiRequest('/auth/me') as { isAdmin?: boolean }
      if (!me.isAdmin) { setIsAdmin(false); return }
      setIsAdmin(true)

      const [statsRes, analyticsRes, usersRes] = await Promise.all([
        apiRequest('/admin/stats') as Promise<AdminStats>,
        apiRequest('/admin/analytics') as Promise<Analytics>,
        apiRequest('/admin/users') as Promise<UsersResponse>,
      ])
      setStats(statsRes)
      setAnalytics(analyticsRes)
      setUsers(usersRes.users)
      setTotal(usersRes.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, []) // eslint-disable-line

  function drillInto(feat: string, label: string) {
    setFeatureFilter(feat)
    setFeatureLabel(label)
    setFilter('')
    setSearch('')
    loadUsers('', '', feat)
  }

  function clearDrill() {
    setFeatureFilter('')
    setFeatureLabel('')
    loadUsers(search, filter, '')
  }

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-ink text-lg font-bold">Access Denied</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="h-6 w-36 bg-card rounded animate-pulse mb-6" />
        {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse mb-3" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-danger text-sm mb-4">{error}</p>
        <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)) }}
          className="bg-accent/15 text-accent font-bold px-5 py-2 rounded-lg text-sm">Retry</button>
      </div>
    )
  }

  const totalLogins = analytics
    ? analytics.platform.android + analytics.platform.iphone + analytics.platform.desktop + analytics.platform.other
    : 0

  const platformData = analytics ? [
    { name: 'Android', value: analytics.platform.android,  color: '#22C55E' },
    { name: 'iPhone',  value: analytics.platform.iphone,   color: '#3B82F6' },
    { name: 'Desktop', value: analytics.platform.desktop,  color: '#C8A84B' },
    { name: 'Other',   value: analytics.platform.other,    color: '#606060' },
  ].filter(d => d.value > 0) : []

  const loginMethodData = analytics ? [
    { name: 'Google', value: analytics.loginMethod.google, color: '#EF4444' },
    { name: 'Email',  value: analytics.loginMethod.email,  color: '#C8A84B' },
  ].filter(d => d.value > 0) : []

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-ink text-2xl font-black flex-1">Admin Panel</h1>
        <span className="bg-accent/15 text-accent text-xs font-bold px-3 py-1 rounded-md">ADMIN</span>
      </div>

      {/* ── User Overview ── */}
      {stats && (
        <>
          <SectionTitle>Users</SectionTitle>
          <div className="flex gap-3 mb-3 flex-wrap">
            <StatCard label="Total"      value={stats.users.total} />
            <StatCard label="Active Pro" value={stats.users.active}  color="#22C55E" onClick={() => { setFilter('active'); setFeatureFilter(''); loadUsers(search, 'active', '') }} />
            <StatCard label="On Trial"   value={stats.users.trial}   color="#C8A84B" onClick={() => { setFilter('trial'); setFeatureFilter(''); loadUsers(search, 'trial', '') }} />
            <StatCard label="Expired"    value={stats.users.expired} color="#EF4444" onClick={() => { setFilter('expired'); setFeatureFilter(''); loadUsers(search, 'expired', '') }} />
          </div>
          <div className="flex gap-3 mb-3 flex-wrap">
            <StatCard label="New Today"    value={stats.users.newToday}        color="#3B82F6" />
            <StatCard label="New This Week" value={stats.users.newThisWeek}    color="#3B82F6" />
            <StatCard label="Trial Ending" value={stats.users.trialEndingThisWeek} color="#F59E0B" onClick={() => { setFilter('trial'); setFeatureFilter(''); loadUsers(search, 'trial', '') }} />
            <StatCard label="Banned"       value={stats.users.banned}          color="#EF4444" onClick={() => { setFilter('banned'); setFeatureFilter(''); loadUsers(search, 'banned', '') }} />
          </div>
          <div className="flex gap-3 mb-8 flex-wrap">
            <StatCard label="Active Last 7d"   value={stats.users.activeLastWeek} color="#22C55E"
              sub="logged in" onClick={() => drillInto('active_week', 'Active Last 7 Days')} />
            <StatCard label="Never Logged In"  value={stats.users.neverLoggedIn} color="#F59E0B"
              onClick={() => drillInto('inactive', 'Never Logged In')} />
            <StatCard label="0 Seasons Created" value={stats.users.noSeasons} color="#A0A0A0"
              onClick={() => drillInto('no_seasons', 'No Seasons Created')} />
          </div>

          {/* ── Feature Adoption ── */}
          <SectionTitle>Feature Adoption</SectionTitle>
          <div className="flex gap-3 mb-3 flex-wrap">
            <StatCard label="Use Breeding" value={stats.adoption.usersWithSeasons}
              color="#C8A84B" onClick={() => drillInto('seasons', 'Using Breeding')} />
            <StatCard label="Generated Markings" value={stats.adoption.usersWithMarkings}
              color="#C8A84B" onClick={() => drillInto('markings', 'Generated Markings')} />
            <StatCard label="Use Finance" value={stats.adoption.usersWithFinance}
              color="#3B82F6" onClick={() => drillInto('finance', 'Using Finance')} />
          </div>
          <div className="flex gap-3 mb-8 flex-wrap">
            <StatCard label="Have Workers"  value={stats.adoption.usersWithWorkers}
              color="#3B82F6" onClick={() => drillInto('workers', 'Have Workers')} />
            <StatCard label="Log Expenses"  value={stats.adoption.usersWithExpenses}
              color="#3B82F6" onClick={() => drillInto('expenses', 'Log Expenses')} />
          </div>

          {/* ── Breeding & Finance Totals ── */}
          <SectionTitle>Platform Totals</SectionTitle>
          <div className="flex gap-3 mb-3 flex-wrap">
            <StatCard label="Seasons"   value={stats.breeding.totalSeasons} />
            <StatCard label="Matings"   value={stats.breeding.totalMatings} />
            <StatCard label="Markings Generated" value={stats.breeding.totalMarkingsGenerated} color="#C8A84B" />
          </div>
          <div className="flex gap-3 mb-8 flex-wrap">
            <StatCard label="Workers"   value={stats.finance.totalWorkers} />
            <StatCard label="Expenses"  value={stats.finance.totalExpenses} />
          </div>

          {/* Expense category breakdown */}
          {stats.finance.expenseByCat.length > 0 && (
            <div className="bg-card border border-rim rounded-xl p-4 mb-8">
              <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Expense Entries by Category</p>
              <div className="flex flex-col gap-2">
                {stats.finance.expenseByCat.map(c => (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-ink-2 text-sm w-36 shrink-0">{CAT_LABEL[c.category] ?? c.category}</span>
                    <div className="flex-1 bg-canvas rounded-full h-2 overflow-hidden">
                      <div className="bg-accent h-2 rounded-full"
                        style={{ width: `${Math.round((c.count / stats.finance.totalExpenses) * 100)}%` }} />
                    </div>
                    <span className="text-ink-2 text-sm font-semibold w-8 text-right">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Registrations Chart ── */}
          <SectionTitle>Registrations — Last 30 Days</SectionTitle>
          <div className="bg-card border border-rim rounded-xl p-4 mb-8">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={stats.dailyRegistrations}>
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }}
                  labelStyle={{ color: '#A0A0A0', fontSize: 11 }} itemStyle={{ color: '#C8A84B', fontSize: 12 }}
                  labelFormatter={(d: unknown) => fmtDate(String(d))} />
                <Line type="monotone" dataKey="count" stroke="#C8A84B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── Analytics ── */}
      {analytics && (
        <>
          {/* Daily Logins Chart */}
          <SectionTitle>Daily Logins — Last 30 Days</SectionTitle>
          <div className="bg-card border border-rim rounded-xl p-4 mb-8">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={analytics.dailyLogins}>
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }}
                  labelStyle={{ color: '#A0A0A0', fontSize: 11 }} itemStyle={{ color: '#3B82F6', fontSize: 12 }}
                  labelFormatter={(d: unknown) => fmtDate(String(d))} />
                <Bar dataKey="count" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Platform + Login Method */}
          <div className="flex gap-4 mb-8 flex-wrap">
            {/* Platform donut */}
            <div className="flex-1 bg-card border border-rim rounded-xl p-4 min-w-[200px]">
              <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Platform ({totalLogins} logins)</p>
              <div className="flex items-center gap-4">
                <PieChart width={90} height={90}>
                  <Pie data={platformData} dataKey="value" cx={40} cy={40} innerRadius={25} outerRadius={40} strokeWidth={0}>
                    {platformData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
                <div className="flex flex-col gap-1.5">
                  {platformData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-ink-2 text-xs">{d.name}</span>
                      <span className="text-ink text-xs font-bold ml-auto pl-3">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Login method donut */}
            <div className="flex-1 bg-card border border-rim rounded-xl p-4 min-w-[200px]">
              <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Login Method</p>
              <div className="flex items-center gap-4">
                <PieChart width={90} height={90}>
                  <Pie data={loginMethodData} dataKey="value" cx={40} cy={40} innerRadius={25} outerRadius={40} strokeWidth={0}>
                    {loginMethodData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
                <div className="flex flex-col gap-1.5">
                  {loginMethodData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-ink-2 text-xs">{d.name}</span>
                      <span className="text-ink text-xs font-bold ml-auto pl-3">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Users List ── */}
      {/* Feature drill-down banner */}
      {featureFilter && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <p className="text-accent text-sm font-bold">Showing: {featureLabel}</p>
          <button onClick={clearDrill} className="text-ink-3 text-xs hover:text-ink">✕ Clear</button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); loadUsers(e.target.value, filter, featureFilter) }}
        placeholder="Search username, email, TK-ID…"
        className="w-full bg-card border border-rim rounded-xl px-4 py-3 text-ink text-sm outline-none focus:border-accent placeholder:text-ink-3 mb-3"
      />

      {/* Filter pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value}
            onClick={() => { setFilter(f.value); setFeatureFilter(''); setFeatureLabel(''); loadUsers(search, f.value, '') }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filter === f.value && !featureFilter
                ? 'bg-accent border-accent text-canvas'
                : 'bg-card border-rim text-ink-2 hover:border-accent/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SectionTitle>Users ({total})</SectionTitle>

      {users.length === 0 ? (
        <p className="text-ink-3 text-sm text-center py-10">No users found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(user => {
            const sc = statusColor(user.subscriptionStatus)
            return (
              <Link key={user._id} href={`/admin/user/${user._id}`}
                className="bg-card border border-rim rounded-xl px-4 py-3 flex items-center gap-3 hover:border-accent/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-ink font-bold text-sm">@{user.username}</span>
                    {user.isAdmin  && <span className="bg-accent/15 text-accent text-[9px] font-bold px-1.5 py-0.5 rounded">ADMIN</span>}
                    {user.isBanned && <span className="bg-danger/15 text-danger text-[9px] font-bold px-1.5 py-0.5 rounded">BANNED</span>}
                  </div>
                  <p className="text-ink-3 text-xs truncate">{user.tiknokId ?? '—'} · {user.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`${sc.bg} ${sc.text} text-[11px] font-bold px-2.5 py-0.5 rounded-full`}>
                    {user.subscriptionStatus}
                  </span>
                  <span className="text-ink-3 text-[10px]">
                    {user.subscriptionStatus === 'trial'  ? daysUntil(user.trialEndsAt) :
                     user.subscriptionStatus === 'active' ? daysUntil(user.paidUntil)   : ''}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
