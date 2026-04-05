'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  _id: string
  username: string
  email: string
  tiknokId: string | null
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended'
  subscriptionTier: 'free' | 'pro'
  trialEndsAt: string | null
  paidUntil: string | null
  dataDeletesAt: string | null
  isAdmin: boolean
  isBreeder: boolean
  isBanned: boolean
  banReason: string | null
  bannedAt: string | null
  profilePhoto: string | null
  authProviders: string[]
  createdAt: string | null
}

type LoginEventItem = {
  _id: string
  ip: string | null
  userAgent: string | null
  method: 'local' | 'google'
  success: boolean
  createdAt: string
}

type SeasonItem = {
  _id: string
  name: string
  year: number
  markingsGenerated: boolean
  matingCount: number
  eggsLaid: number | null
  chicksHatched: number | null
  createdAt: string
}

type WorkerItem = {
  _id: string
  name: string
  position: string
  monthlySalary: number
  advanceCount: number
  paymentCount: number
  createdAt: string
}

type ExpenseItem = {
  _id: string
  category: string
  name: string | null
  totalAmount: number
  date: string | null
  month: number
  year: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'active')    return 'bg-[#22C55E22] text-[#22C55E]'
  if (s === 'trial')     return 'bg-[#C8A84B22] text-[#C8A84B]'
  if (s === 'expired')   return 'bg-[#EF444422] text-[#EF4444]'
  if (s === 'suspended') return 'bg-[#A0A0A022] text-[#A0A0A0]'
  return 'bg-card text-ink-3'
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDT(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return '(ended)'
  return `(${diff}d left)`
}

function catLabel(c: string) {
  const map: Record<string, string> = {
    feeds: 'Feeds', vitamins: 'Vitamins', medicines: 'Medicines',
    deworming: 'Deworming', workers_extra_budget: 'Workers Extra', miscellaneous: 'Misc',
  }
  return map[c] ?? c
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex justify-between items-center">
      <span className="text-ink-3 text-sm">{label}</span>
      <span className="text-ink text-sm font-medium text-right">{value}</span>
    </div>
  )
}

// ─── Tab: Profile ─────────────────────────────────────────────────────────────

function ProfileTab({
  user, userId, onRefresh,
}: { user: AdminUser; userId: string; onRefresh: () => void }) {
  const router = useRouter()
  const [acting, setActing]         = useState('')
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  // Edit email
  const [editEmail, setEditEmail]   = useState(false)
  const [newEmail, setNewEmail]     = useState(user.email)

  // Edit password
  const [editPw, setEditPw]         = useState(false)
  const [newPw, setNewPw]           = useState('')

  // Ban
  const [showBan, setShowBan]       = useState(false)
  const [banReason, setBanReason]   = useState('')

  async function post(endpoint: string, body?: object) {
    if (acting) return
    setActing(endpoint)
    setError('')
    setSuccess('')
    try {
      await apiRequest(endpoint, { method: 'POST', body })
      setSuccess('Done.')
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActing('')
    }
  }

  async function patch(endpoint: string, body: object) {
    if (acting) return
    setActing(endpoint)
    setError('')
    setSuccess('')
    try {
      await apiRequest(endpoint, { method: 'PATCH', body })
      setSuccess('Done.')
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActing('')
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete @${user.username}? This cannot be undone.`)) return
    setActing('delete')
    setError('')
    try {
      await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' })
      router.push('/admin')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setActing('')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subscription info */}
      <div className="bg-card border border-rim rounded-xl divide-y divide-rim">
        <InfoRow label="Email"  value={user.email} />
        <InfoRow label="Tier"   value={<span className="capitalize">{user.subscriptionTier}</span>} />
        <InfoRow label="Status" value={
          <span className={`${statusColor(user.subscriptionStatus)} text-xs font-bold px-2.5 py-0.5 rounded-full`}>
            {user.subscriptionStatus}
          </span>
        } />
        <InfoRow label="Trial ends"    value={<>{fmt(user.trialEndsAt)} <span className="text-ink-3 text-xs">{daysUntil(user.trialEndsAt)}</span></>} />
        <InfoRow label="Paid until"    value={<>{fmt(user.paidUntil)} <span className="text-ink-3 text-xs">{daysUntil(user.paidUntil)}</span></>} />
        {user.dataDeletesAt && <InfoRow label="Data deletes" value={<span className="text-danger">{fmt(user.dataDeletesAt)}</span>} />}
        <InfoRow label="Auth"    value={(user.authProviders ?? ['local']).join(', ')} />
        <InfoRow label="Joined"  value={fmt(user.createdAt)} />
        {user.isBanned && (
          <>
            <InfoRow label="Banned at"  value={<span className="text-danger">{fmt(user.bannedAt)}</span>} />
            {user.banReason && <InfoRow label="Ban reason" value={<span className="text-danger text-xs">{user.banReason}</span>} />}
          </>
        )}
      </div>

      {/* Feedback */}
      {error   && <div className="bg-danger/10 border border-danger/25 rounded-xl px-4 py-3"><p className="text-danger text-sm">{error}</p></div>}
      {success && <div className="bg-[#22C55E11] border border-[#22C55E33] rounded-xl px-4 py-3"><p className="text-[#22C55E] text-sm">{success}</p></div>}

      {/* Edit email */}
      {editEmail ? (
        <div className="bg-card border border-rim rounded-xl p-4 flex flex-col gap-3">
          <p className="text-ink text-sm font-bold">Change Email</p>
          <input
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            type="email"
            placeholder="New email address"
            className="bg-canvas border border-rim rounded-lg px-3 py-2.5 text-ink text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={() => patch(`/admin/users/${userId}/email`, { email: newEmail })}
              disabled={!!acting}
              className="flex-1 bg-accent/15 border border-accent/40 text-accent font-bold py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              {acting.includes('email') ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditEmail(false); setNewEmail(user.email) }}
              className="flex-1 bg-card border border-rim text-ink-2 font-bold py-2.5 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditEmail(true)}
          className="w-full bg-card border border-rim text-ink-2 font-bold py-3 rounded-xl text-sm hover:border-accent/30 transition-colors text-left px-4">
          ✏ Change Email
        </button>
      )}

      {/* Reset password */}
      {editPw ? (
        <div className="bg-card border border-rim rounded-xl p-4 flex flex-col gap-3">
          <p className="text-ink text-sm font-bold">Set New Password</p>
          <input
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            type="password"
            placeholder="New password (min 8 chars)"
            className="bg-canvas border border-rim rounded-lg px-3 py-2.5 text-ink text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { post(`/admin/users/${userId}/password`, { password: newPw }); setEditPw(false); setNewPw('') }}
              disabled={!!acting || newPw.length < 8}
              className="flex-1 bg-accent/15 border border-accent/40 text-accent font-bold py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              {acting.includes('password') ? 'Saving…' : 'Set Password'}
            </button>
            <button onClick={() => { setEditPw(false); setNewPw('') }}
              className="flex-1 bg-card border border-rim text-ink-2 font-bold py-2.5 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditPw(true)}
          className="w-full bg-card border border-rim text-ink-2 font-bold py-3 rounded-xl text-sm hover:border-accent/30 transition-colors text-left px-4">
          🔑 Reset Password
        </button>
      )}

      {/* Subscription actions */}
      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider">Subscription</p>
      <div className="flex flex-col gap-2">
        <button onClick={() => post(`/admin/activate/${userId}`, { days: 30 })} disabled={!!acting}
          className="w-full bg-[#22C55E15] border border-[#22C55E44] text-[#22C55E] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#22C55E25] transition-colors">
          {acting.includes('activate') ? 'Activating…' : 'Activate — 1 Month'}
        </button>
        <button onClick={() => post(`/admin/activate/${userId}`, { days: 365 })} disabled={!!acting}
          className="w-full bg-[#22C55E15] border border-[#22C55E44] text-[#22C55E] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#22C55E25] transition-colors">
          {acting.includes('activate') ? 'Activating…' : 'Activate — 1 Year'}
        </button>
        <button onClick={() => post(`/admin/extend/${userId}`, { days: 7 })} disabled={!!acting}
          className="w-full bg-[#3B82F615] border border-[#3B82F644] text-[#3B82F6] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#3B82F625] transition-colors">
          {acting.includes('extend') ? 'Extending…' : 'Extend Grace — 7 Days'}
        </button>
      </div>

      {/* Ban / Suspend */}
      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider">Account Status</p>
      <div className="flex flex-col gap-2">
        {user.isBanned ? (
          <button onClick={() => post(`/admin/users/${userId}/unban`)} disabled={!!acting}
            className="w-full bg-[#22C55E15] border border-[#22C55E44] text-[#22C55E] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#22C55E25] transition-colors">
            {acting.includes('unban') ? 'Unbanning…' : 'Unban Account'}
          </button>
        ) : (
          !user.isAdmin && (
            showBan ? (
              <div className="bg-card border border-danger/30 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-danger text-sm font-bold">Ban @{user.username}</p>
                <input
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Ban reason (optional)"
                  className="bg-canvas border border-rim rounded-lg px-3 py-2.5 text-ink text-sm outline-none focus:border-danger"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { post(`/admin/users/${userId}/ban`, { reason: banReason }); setShowBan(false) }}
                    disabled={!!acting}
                    className="flex-1 bg-danger/15 border border-danger/40 text-danger font-bold py-2.5 rounded-lg text-sm disabled:opacity-50">
                    Confirm Ban
                  </button>
                  <button onClick={() => { setShowBan(false); setBanReason('') }}
                    className="flex-1 bg-card border border-rim text-ink-2 font-bold py-2.5 rounded-lg text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowBan(true)} disabled={!!acting}
                className="w-full bg-danger/10 border border-danger/30 text-danger font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-danger/20 transition-colors">
                Ban Account
              </button>
            )
          )
        )}

        {!user.isAdmin && !user.isBanned && (
          user.subscriptionStatus === 'suspended' ? (
            <button onClick={() => post(`/admin/unsuspend/${userId}`)} disabled={!!acting}
              className="w-full bg-accent/15 border border-accent/40 text-accent font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-accent/25 transition-colors">
              {acting.includes('unsuspend') ? 'Unsuspending…' : 'Unsuspend Account'}
            </button>
          ) : (
            <button onClick={() => post(`/admin/suspend/${userId}`)} disabled={!!acting}
              className="w-full bg-[#F59E0B15] border border-[#F59E0B44] text-[#F59E0B] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#F59E0B25] transition-colors">
              {acting.includes('suspend') ? 'Suspending…' : 'Suspend Account'}
            </button>
          )
        )}
      </div>

      {/* Delete */}
      {!user.isAdmin && (
        <>
          <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider">Danger Zone</p>
          <button onClick={handleDelete} disabled={!!acting}
            className="w-full bg-danger/10 border border-danger/30 text-danger font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-danger/20 transition-colors">
            {acting === 'delete' ? 'Deleting…' : 'Delete Account'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Tab: Login Activity ──────────────────────────────────────────────────────

function LoginActivityTab({ userId }: { userId: string }) {
  const [events, setEvents]   = useState([] as LoginEventItem[])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    apiRequest(`/admin/users/${userId}/logins`)
      .then(data => setEvents((data as { events: LoginEventItem[] }).events))
      .catch(() => setError('Failed to load login history'))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="flex flex-col gap-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
  if (error)   return <p className="text-danger text-sm">{error}</p>
  if (!events.length) return <p className="text-ink-3 text-sm text-center py-10">No login history found.</p>

  return (
    <div className="flex flex-col gap-2">
      {events.map(e => (
        <div key={e._id} className={`bg-card border rounded-xl px-4 py-3 ${e.success ? 'border-rim' : 'border-danger/30'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                e.success ? 'bg-[#22C55E22] text-[#22C55E]' : 'bg-danger/15 text-danger'
              }`}>
                {e.success ? 'Success' : 'Failed'}
              </span>
              <span className="text-ink-2 text-xs capitalize">{e.method}</span>
            </div>
            <span className="text-ink-3 text-xs">{fmtDT(e.createdAt)}</span>
          </div>
          <p className="text-ink-3 text-xs font-mono truncate">{e.ip ?? '—'}</p>
          <p className="text-ink-3 text-[11px] truncate mt-0.5">{e.userAgent ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Breeding Data ───────────────────────────────────────────────────────

function BreedingTab({ userId }: { userId: string }) {
  const [seasons, setSeasons] = useState([] as SeasonItem[])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    apiRequest(`/admin/users/${userId}/breeding`)
      .then(data => setSeasons((data as { seasons: SeasonItem[] }).seasons))
      .catch(() => setError('Failed to load breeding data'))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}</div>
  if (error)   return <p className="text-danger text-sm">{error}</p>
  if (!seasons.length) return <p className="text-ink-3 text-sm text-center py-10">No breeding seasons found.</p>

  return (
    <div className="flex flex-col gap-2">
      {seasons.map(s => (
        <div key={s._id} className="bg-card border border-rim rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ink font-bold text-sm">{s.name}</span>
            <span className="text-ink-3 text-xs">{s.year}</span>
          </div>
          <div className="flex gap-4 mt-1">
            <span className="text-ink-3 text-xs">{s.matingCount} matings</span>
            {s.eggsLaid != null    && <span className="text-ink-3 text-xs">{s.eggsLaid} eggs</span>}
            {s.chicksHatched != null && <span className="text-ink-3 text-xs">{s.chicksHatched} hatched</span>}
            {s.markingsGenerated && <span className="text-[#22C55E] text-xs">✓ Markings</span>}
          </div>
          <p className="text-ink-3 text-[11px] mt-1">{fmt(s.createdAt)}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Farm Finance ────────────────────────────────────────────────────────

function FinanceTab({ userId }: { userId: string }) {
  const [data, setData]       = useState(null as { workers: WorkerItem[]; recentExpenses: ExpenseItem[]; summary: { totalWorkers: number; totalSalaryDue: number; expensesThisMonth: number } } | null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    apiRequest(`/admin/users/${userId}/finances`)
      .then(d => setData(d as typeof data))
      .catch(() => setError('Failed to load finance data'))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
  if (error)   return <p className="text-danger text-sm">{error}</p>
  if (!data)   return null

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="bg-card border border-rim rounded-xl divide-y divide-rim">
        <InfoRow label="Total Workers"    value={data.summary.totalWorkers} />
        <InfoRow label="Total Salary/mo"  value={`₱${data.summary.totalSalaryDue.toLocaleString()}`} />
        <InfoRow label="Expenses (month)" value={`₱${data.summary.expensesThisMonth.toLocaleString()}`} />
      </div>

      {/* Workers */}
      {data.workers.length > 0 && (
        <>
          <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider">Workers</p>
          <div className="flex flex-col gap-2">
            {data.workers.map(w => (
              <div key={w._id} className="bg-card border border-rim rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-ink font-bold text-sm">{w.name}</p>
                    <p className="text-ink-3 text-xs">{w.position}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-ink text-sm font-semibold">₱{w.monthlySalary.toLocaleString()}/mo</p>
                    <p className="text-ink-3 text-xs">{w.advanceCount} advances · {w.paymentCount} paid</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recent Expenses */}
      {data.recentExpenses.length > 0 && (
        <>
          <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider">Recent Expenses</p>
          <div className="flex flex-col gap-1.5">
            {data.recentExpenses.map(e => (
              <div key={e._id} className="bg-card border border-rim rounded-xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-ink-3 text-[11px] font-semibold uppercase">{catLabel(e.category)}</span>
                  {e.name && <p className="text-ink text-xs">{e.name}</p>}
                </div>
                <div className="text-right">
                  <p className="text-accent text-sm font-bold">₱{e.totalAmount.toLocaleString()}</p>
                  <p className="text-ink-3 text-[11px]">{fmt(e.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data.workers.length === 0 && data.recentExpenses.length === 0 && (
        <p className="text-ink-3 text-sm text-center py-10">No finance data found.</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Login Activity', 'Breeding Data', 'Farm Finance'] as const
type Tab = typeof TABS[number]

export default function AdminUserDetailPage() {
  const params  = useParams()
  const userId  = params.userId as string

  const [user, setUser]       = useState(null as AdminUser | null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState<Tab>('Profile')

  function loadUser() {
    setLoading(true)
    apiRequest(`/admin/users/${userId}`)
      .then(data => setUser(data as AdminUser))
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUser() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="p-6 max-w-xl">
        <div className="h-4 w-24 bg-card rounded animate-pulse mb-6" />
        <div className="h-24 bg-card rounded-xl animate-pulse mb-4" />
        {[1,2,3,4].map(i => <div key={i} className="h-14 bg-card rounded-xl animate-pulse mb-3" />)}
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="p-6">
        <Link href="/admin" className="text-accent text-sm hover:opacity-80">‹ Back to Admin</Link>
        <p className="text-danger text-sm mt-6">{error}</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="p-6 max-w-xl">
      <Link href="/admin" className="text-accent text-sm hover:opacity-80">‹ Back to Admin</Link>

      {/* User header */}
      <div className="mt-4 mb-5 bg-card border border-rim rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xl font-black shrink-0 overflow-hidden">
            {user.profilePhoto
              ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
              : user.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-ink text-lg font-bold">@{user.username}</span>
              {user.isAdmin  && <span className="bg-accent/15 text-accent text-[9px] font-bold px-2 py-0.5 rounded">ADMIN</span>}
              {user.isBreeder && <span className="text-base">🐓</span>}
              {user.isBanned && <span className="bg-danger/15 text-danger text-[9px] font-bold px-2 py-0.5 rounded">BANNED</span>}
            </div>
            <p className="text-ink-3 text-xs mb-1">{user.email}</p>
            {user.tiknokId && <p className="text-ink-2 text-xs font-mono">{user.tiknokId}</p>}
          </div>
          <span className={`${statusColor(user.subscriptionStatus)} text-xs font-bold px-3 py-1 rounded-full shrink-0`}>
            {user.subscriptionStatus}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-card border border-rim rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              tab === t
                ? 'bg-accent text-canvas'
                : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Profile'        && <ProfileTab user={user} userId={userId} onRefresh={loadUser} />}
      {tab === 'Login Activity' && <LoginActivityTab userId={userId} />}
      {tab === 'Breeding Data'  && <BreedingTab userId={userId} />}
      {tab === 'Farm Finance'   && <FinanceTab userId={userId} />}
    </div>
  )
}
