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
  trialEndsAt: string | null; paidUntil: string | null
  isAdmin: boolean; isBanned: boolean; createdAt: string | null
}

type UsersResponse = { users: AdminUser[]; total: number }

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

function fmtDate(d: unknown) {
  const dt = new Date(String(d))
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

const CAT_LABEL: Record<string, string> = {
  feeds: 'Feeds', vitamins: 'Vitamins', medicines: 'Medicines',
  deworming: 'Deworming', workers_extra_budget: 'Workers Extra', miscellaneous: 'Misc',
}

const STATUS_FILTERS = [
  { label: 'All', value: '' }, { label: 'Trial', value: 'trial' },
  { label: 'Active', value: 'active' }, { label: 'Expired', value: 'expired' },
  { label: 'Suspended', value: 'suspended' }, { label: 'Banned', value: 'banned' },
]

const TABS = ['Overview', 'Adoption', 'Analytics', 'Users'] as const
type Tab = typeof TABS[number]

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, sub, onClick,
}: { label: string; value: number; color?: string; sub?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex-1 bg-card border border-rim rounded-xl p-4 min-w-[130px] ${
        onClick ? 'cursor-pointer hover:border-accent/50 transition-colors' : ''
      }`}
    >
      <p className="text-2xl font-black" style={{ color: color ?? '#FFFFFF' }}>{value}</p>
      <p className="text-ink-3 text-xs mt-1 leading-tight">{label}</p>
      {sub   && <p className="text-ink-3 text-[10px] mt-0.5">{sub}</p>}
      {onClick && <p className="text-accent text-[10px] mt-1.5 font-semibold">View users →</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab]             = useState<Tab>('Overview')
  const [stats, setStats]         = useState<AdminStats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null)

  // Users tab state
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [total, setTotal]           = useState(0)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [featureFilter, setFeatureFilter] = useState('')
  const [featureLabel, setFeatureLabel]   = useState('')

  // ── load stats on mount ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const me = await apiRequest('/auth/me') as { isAdmin?: boolean }
        if (!me.isAdmin) { setIsAdmin(false); return }
        setIsAdmin(true)
        const [s, a] = await Promise.all([
          apiRequest('/admin/stats') as Promise<AdminStats>,
          apiRequest('/admin/analytics') as Promise<Analytics>,
        ])
        setStats(s)
        setAnalytics(a)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // ── load users whenever Users tab becomes active or filters change ────────
  const fetchUsers = useCallback(async (q: string, sf: string, ff: string) => {
    setUsersLoading(true)
    setUsersError('')
    try {
      const params = new URLSearchParams()
      if (sf) params.set('status', sf)
      if (q)  params.set('search', q)
      if (ff) params.set('feature', ff)
      const res = await apiRequest(`/admin/users?${params.toString()}`) as UsersResponse
      setUsers(res.users)
      setTotal(res.total)
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'Users') {
      fetchUsers(search, statusFilter, featureFilter)
    }
  }, [tab]) // eslint-disable-line

  // ── drill into users from a stat card ────────────────────────────────────
  function drillInto(feat: string, label: string) {
    setFeatureFilter(feat)
    setFeatureLabel(label)
    setStatusFilter('')
    setSearch('')
    setTab('Users')
    // fetchUsers will be called by the tab useEffect above,
    // but we need the new values — call directly with explicit args
    setTimeout(() => fetchUsers('', '', feat), 0)
  }

  function drillByStatus(status: string) {
    setStatusFilter(status)
    setFeatureFilter('')
    setFeatureLabel('')
    setSearch('')
    setTab('Users')
    setTimeout(() => fetchUsers('', status, ''), 0)
  }

  // ─── Guards ───────────────────────────────────────────────────────────────

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
      <div className="p-6 max-w-3xl">
        <div className="h-6 w-36 bg-card rounded animate-pulse mb-6" />
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse mb-3" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-danger text-sm mb-4">{error}</p>
        <button onClick={() => window.location.reload()}
          className="bg-accent/15 text-accent font-bold px-5 py-2 rounded-lg text-sm">Retry</button>
      </div>
    )
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const totalLogins = analytics
    ? analytics.platform.android + analytics.platform.iphone + analytics.platform.desktop + analytics.platform.other
    : 0

  const platformData = analytics ? [
    { name: 'Android', value: analytics.platform.android, color: '#22C55E' },
    { name: 'iPhone',  value: analytics.platform.iphone,  color: '#3B82F6' },
    { name: 'Desktop', value: analytics.platform.desktop, color: '#C8A84B' },
    { name: 'Other',   value: analytics.platform.other,   color: '#606060' },
  ].filter(d => d.value > 0) : []

  const loginMethodData = analytics ? [
    { name: 'Google', value: analytics.loginMethod.google, color: '#EF4444' },
    { name: 'Email',  value: analytics.loginMethod.email,  color: '#C8A84B' },
  ].filter(d => d.value > 0) : []

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-ink text-2xl font-black flex-1">Admin Panel</h1>
        <span className="bg-accent/15 text-accent text-xs font-bold px-3 py-1 rounded-md">ADMIN</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-rim rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              tab === t ? 'bg-accent text-canvas' : 'text-ink-3 hover:text-ink-2'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {tab === 'Overview' && stats && (
        <div className="flex flex-col gap-6">
          {/* Subscription */}
          <div>
            <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Subscriptions</p>
            <div className="flex gap-3 flex-wrap mb-3">
              <StatCard label="Total Users"  value={stats.users.total} />
              <StatCard label="Active (Pro)" value={stats.users.active}  color="#22C55E" onClick={() => drillByStatus('active')} />
              <StatCard label="On Trial"     value={stats.users.trial}   color="#C8A84B" onClick={() => drillByStatus('trial')} />
              <StatCard label="Expired"      value={stats.users.expired} color="#EF4444" onClick={() => drillByStatus('expired')} />
            </div>
            <div className="flex gap-3 flex-wrap">
              <StatCard label="Suspended"         value={stats.users.suspended}            color="#A0A0A0" onClick={() => drillByStatus('suspended')} />
              <StatCard label="Banned"            value={stats.users.banned}               color="#EF4444" onClick={() => drillByStatus('banned')} />
              <StatCard label="Trial Ending Soon" value={stats.users.trialEndingThisWeek}  color="#F59E0B" />
            </div>
          </div>

          {/* Activity */}
          <div>
            <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Activity</p>
            <div className="flex gap-3 flex-wrap mb-3">
              <StatCard label="New Today"      value={stats.users.newToday}      color="#3B82F6" />
              <StatCard label="New This Week"  value={stats.users.newThisWeek}   color="#3B82F6" />
              <StatCard label="Active Last 7d" value={stats.users.activeLastWeek} color="#22C55E"
                sub="logged in" onClick={() => drillInto('active_week', 'Active Last 7 Days')} />
            </div>
            <div className="flex gap-3 flex-wrap">
              <StatCard label="Never Logged In"   value={stats.users.neverLoggedIn} color="#F59E0B"
                onClick={() => drillInto('inactive', 'Never Logged In')} />
              <StatCard label="No Seasons Yet"    value={stats.users.noSeasons}     color="#A0A0A0"
                onClick={() => drillInto('no_seasons', 'No Seasons Created')} />
            </div>
          </div>

          {/* Platform Totals */}
          <div>
            <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Platform Totals</p>
            <div className="flex gap-3 flex-wrap mb-3">
              <StatCard label="Seasons"            value={stats.breeding.totalSeasons} />
              <StatCard label="Matings"            value={stats.breeding.totalMatings} />
              <StatCard label="Markings Generated" value={stats.breeding.totalMarkingsGenerated} color="#C8A84B" />
            </div>
            <div className="flex gap-3 flex-wrap">
              <StatCard label="Workers"  value={stats.finance.totalWorkers} />
              <StatCard label="Expenses" value={stats.finance.totalExpenses} />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Adoption ── */}
      {tab === 'Adoption' && stats && (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Feature Usage</p>
            <div className="flex gap-3 flex-wrap mb-3">
              <StatCard label="Use Breeding"       value={stats.adoption.usersWithSeasons}
                color="#C8A84B" onClick={() => drillInto('seasons', 'Using Breeding')} />
              <StatCard label="Generated Markings" value={stats.adoption.usersWithMarkings}
                color="#C8A84B" onClick={() => drillInto('markings', 'Generated Markings')} />
            </div>
            <div className="flex gap-3 flex-wrap">
              <StatCard label="Use Finance"  value={stats.adoption.usersWithFinance}
                color="#3B82F6" onClick={() => drillInto('finance', 'Using Finance')} />
              <StatCard label="Have Workers" value={stats.adoption.usersWithWorkers}
                color="#3B82F6" onClick={() => drillInto('workers', 'Have Workers')} />
              <StatCard label="Log Expenses" value={stats.adoption.usersWithExpenses}
                color="#3B82F6" onClick={() => drillInto('expenses', 'Log Expenses')} />
            </div>
          </div>

          {/* Expense category breakdown */}
          {stats.finance.expenseByCat.length > 0 && (
            <div>
              <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Expense Entries by Category</p>
              <div className="bg-card border border-rim rounded-xl p-4 flex flex-col gap-3">
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
        </div>
      )}

      {/* ── TAB: Analytics ── */}
      {tab === 'Analytics' && (
        <div className="flex flex-col gap-6">
          {/* Registrations chart */}
          {stats && (
            <div>
              <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Registrations — Last 30 Days</p>
              <div className="bg-card border border-rim rounded-xl p-4">
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={stats.dailyRegistrations}>
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                    <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }}
                      labelStyle={{ color: '#A0A0A0', fontSize: 11 }} itemStyle={{ color: '#C8A84B', fontSize: 12 }}
                      labelFormatter={fmtDate} />
                    <Line type="monotone" dataKey="count" stroke="#C8A84B" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Daily logins chart */}
          {analytics && (
            <div>
              <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Daily Logins — Last 30 Days</p>
              <div className="bg-card border border-rim rounded-xl p-4">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={analytics.dailyLogins}>
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#606060', fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                    <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }}
                      labelStyle={{ color: '#A0A0A0', fontSize: 11 }} itemStyle={{ color: '#3B82F6', fontSize: 12 }}
                      labelFormatter={fmtDate} />
                    <Bar dataKey="count" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Platform + Login method donuts */}
          {analytics && (
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 bg-card border border-rim rounded-xl p-4 min-w-[200px]">
                <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">
                  Platform <span className="normal-case font-normal">({totalLogins} logins)</span>
                </p>
                <div className="flex items-center gap-4">
                  <PieChart width={90} height={90}>
                    <Pie data={platformData} dataKey="value" cx={40} cy={40} innerRadius={25} outerRadius={40} strokeWidth={0}>
                      {platformData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="flex flex-col gap-1.5">
                    {platformData.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-ink-2 text-xs">{d.name}</span>
                        <span className="text-ink text-xs font-bold ml-auto pl-2">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

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
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-ink-2 text-xs">{d.name}</span>
                        <span className="text-ink text-xs font-bold ml-auto pl-2">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Users ── */}
      {tab === 'Users' && (
        <div>
          {/* Feature drill-down banner */}
          {featureFilter && (
            <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <p className="text-accent text-sm font-bold">Showing: {featureLabel}</p>
              <button onClick={() => {
                setFeatureFilter(''); setFeatureLabel('')
                fetchUsers(search, statusFilter, '')
              }} className="text-ink-3 text-xs hover:text-ink">✕ Clear</button>
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); fetchUsers(e.target.value, statusFilter, featureFilter) }}
            placeholder="Search username, email, TK-ID…"
            className="w-full bg-card border border-rim rounded-xl px-4 py-3 text-ink text-sm outline-none focus:border-accent placeholder:text-ink-3 mb-3"
          />

          {/* Status filter pills */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => { setStatusFilter(f.value); setFeatureFilter(''); setFeatureLabel(''); fetchUsers(search, f.value, '') }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  statusFilter === f.value && !featureFilter
                    ? 'bg-accent border-accent text-canvas'
                    : 'bg-card border-rim text-ink-2 hover:border-accent/40'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* List */}
          <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Users ({total})</p>

          {usersLoading ? (
            <div className="flex flex-col gap-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}
            </div>
          ) : usersError ? (
            <p className="text-danger text-sm">{usersError}</p>
          ) : users.length === 0 ? (
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
      )}
    </div>
  )
}
