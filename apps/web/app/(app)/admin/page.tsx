'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminStats = {
  users: {
    total: number
    trial: number
    active: number
    expired: number
    suspended: number
    newToday: number
    newThisWeek: number
    trialEndingThisWeek: number
  }
}

type AdminUser = {
  _id: string
  username: string
  email: string
  tiknokId: string | null
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended'
  subscriptionTier: 'free' | 'pro'
  trialEndsAt: string | null
  paidUntil: string | null
  isAdmin: boolean
  createdAt: string | null
}

type UsersResponse = {
  users: AdminUser[]
  total: number
  page: number
  pages: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'active')    return { bg: 'bg-[#22C55E22]', text: 'text-[#22C55E]', dot: '#22C55E' }
  if (s === 'trial')     return { bg: 'bg-[#C8A84B22]', text: 'text-[#C8A84B]', dot: '#C8A84B' }
  if (s === 'expired')   return { bg: 'bg-[#EF444422]', text: 'text-[#EF4444]', dot: '#EF4444' }
  if (s === 'suspended') return { bg: 'bg-[#A0A0A022]', text: 'text-[#A0A0A0]', dot: '#A0A0A0' }
  return { bg: 'bg-card', text: 'text-ink-3', dot: '#606060' }
}

function statusLabel(s: string) {
  if (s === 'active')    return 'Active'
  if (s === 'trial')     return 'Trial'
  if (s === 'expired')   return 'Expired'
  if (s === 'suspended') return 'Suspended'
  return s
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Ended'
  return `${diff}d left`
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex-1 bg-card border border-rim rounded-xl p-4 min-w-[100px]">
      <p className="text-2xl font-black" style={{ color: color ?? '#FFFFFF' }}>{value}</p>
      <p className="text-ink-3 text-xs mt-1">{label}</p>
    </div>
  )
}

const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Trial',     value: 'trial' },
  { label: 'Active',    value: 'active' },
  { label: 'Expired',   value: 'expired' },
  { label: 'Suspended', value: 'suspended' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()

  const [stats, setStats]     = useState(null as AdminStats | null)
  const [users, setUsers]     = useState([] as AdminUser[])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [isAdmin, setIsAdmin] = useState(null as boolean | null)

  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('')

  const load = useCallback(async (q = search, f = filter) => {
    try {
      setError('')
      const me = await apiRequest('/auth/me') as { isAdmin?: boolean }
      if (!me.isAdmin) { setIsAdmin(false); return }
      setIsAdmin(true)

      const params = new URLSearchParams()
      if (f) params.set('status', f)
      if (q) params.set('search', q)

      const [statsRes, usersRes] = await Promise.all([
        apiRequest('/admin/stats') as Promise<AdminStats>,
        apiRequest(`/admin/users?${params.toString()}`) as Promise<UsersResponse>,
      ])
      setStats(statsRes)
      setUsers(usersRes.users)
      setTotal(usersRes.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [search, filter])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-ink text-lg font-bold">Access Denied</p>
        <p className="text-ink-3 text-sm mt-2">Admin only.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="h-6 w-36 bg-card rounded animate-pulse mb-6" />
        <div className="flex gap-3 mb-4">
          {[1,2,3].map(i => <div key={i} className="flex-1 h-20 bg-card rounded-xl animate-pulse" />)}
        </div>
        <div className="flex gap-3 mb-6">
          {[1,2,3].map(i => <div key={i} className="flex-1 h-20 bg-card rounded-xl animate-pulse" />)}
        </div>
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse mb-2" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-danger text-sm mb-4">{error}</p>
        <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)) }}
          className="bg-accent/15 text-accent font-bold px-5 py-2 rounded-lg text-sm">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-ink text-2xl font-black flex-1">Admin Panel</h1>
        <span className="bg-accent/15 text-accent text-xs font-bold px-3 py-1 rounded-md">ADMIN</span>
      </div>

      {/* Stats */}
      {stats && (
        <>
          <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Overview</p>
          <div className="flex gap-3 mb-3 flex-wrap">
            <StatCard label="Total Users"  value={stats.users.total} />
            <StatCard label="Active (Pro)" value={stats.users.active}  color="#22C55E" />
            <StatCard label="On Trial"     value={stats.users.trial}   color="#C8A84B" />
          </div>
          <div className="flex gap-3 mb-8 flex-wrap">
            <StatCard label="Expired"          value={stats.users.expired}             color="#EF4444" />
            <StatCard label="New Today"         value={stats.users.newToday}            color="#3B82F6" />
            <StatCard label="Trial Ending Soon" value={stats.users.trialEndingThisWeek} color="#F59E0B" />
          </div>
        </>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); load(e.target.value, filter) }}
        placeholder="Search username, email, TK-ID…"
        className="w-full bg-card border border-rim rounded-xl px-4 py-3 text-ink text-sm outline-none focus:border-accent placeholder:text-ink-3 mb-3"
      />

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); load(search, f.value) }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filter === f.value
                ? 'bg-accent border-accent text-canvas'
                : 'bg-card border-rim text-ink-2 hover:border-accent/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Users list */}
      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Users ({total})</p>

      {users.length === 0 ? (
        <p className="text-ink-3 text-sm text-center py-10">No users found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(user => {
            const sc = statusColor(user.subscriptionStatus)
            return (
              <Link
                key={user._id}
                href={`/admin/user/${user._id}`}
                className="bg-card border border-rim rounded-xl px-4 py-3 flex items-center gap-3 hover:border-accent/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-ink font-bold text-sm">@{user.username}</span>
                    {user.isAdmin && (
                      <span className="bg-accent/15 text-accent text-[9px] font-bold px-1.5 py-0.5 rounded">ADMIN</span>
                    )}
                  </div>
                  <p className="text-ink-3 text-xs truncate">{user.tiknokId ?? '—'} · {user.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`${sc.bg} ${sc.text} text-[11px] font-bold px-2.5 py-0.5 rounded-full`}>
                    {statusLabel(user.subscriptionStatus)}
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
