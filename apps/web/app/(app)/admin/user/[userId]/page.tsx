'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

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
  createdAt: string | null
  profilePhoto: string | null
}

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

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return '(ended)'
  return `(${diff}d left)`
}

export default function AdminUserDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const userId   = params.userId as string

  const [user, setUser]       = useState(null as AdminUser | null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [acting, setActing]   = useState('')  // which action is in-flight

  useEffect(() => {
    apiRequest(`/admin/users/${userId}`)
      .then(data => setUser(data as AdminUser))
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false))
  }, [userId])

  async function act(endpoint: string, body?: object) {
    if (acting) return
    setActing(endpoint)
    setError('')
    try {
      const updated = await apiRequest(endpoint, { method: 'POST', body }) as Partial<AdminUser>
      // Refresh user data after action
      const fresh = await apiRequest(`/admin/users/${userId}`) as AdminUser
      setUser(fresh)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing('')
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete @${user?.username}? This cannot be undone.`)) return
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
      <div className="mt-4 mb-6 bg-card border border-rim rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xl font-black shrink-0 overflow-hidden">
            {user.profilePhoto
              ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
              : user.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-ink text-lg font-bold">@{user.username}</span>
              {user.isAdmin && <span className="bg-accent/15 text-accent text-[9px] font-bold px-2 py-0.5 rounded">ADMIN</span>}
              {user.isBreeder && <span className="text-base">🐓</span>}
            </div>
            <p className="text-ink-3 text-xs mb-2">{user.email}</p>
            {user.tiknokId && <p className="text-ink-2 text-xs font-mono">{user.tiknokId}</p>}
          </div>
          <span className={`${statusColor(user.subscriptionStatus)} text-xs font-bold px-3 py-1 rounded-full shrink-0`}>
            {user.subscriptionStatus}
          </span>
        </div>
      </div>

      {/* Subscription info */}
      <div className="bg-card border border-rim rounded-xl divide-y divide-rim mb-6">
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-ink-3 text-sm">Tier</span>
          <span className="text-ink text-sm font-semibold capitalize">{user.subscriptionTier}</span>
        </div>
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-ink-3 text-sm">Trial ends</span>
          <span className="text-ink text-sm">{fmt(user.trialEndsAt)} <span className="text-ink-3 text-xs">{daysUntil(user.trialEndsAt)}</span></span>
        </div>
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-ink-3 text-sm">Paid until</span>
          <span className="text-ink text-sm">{fmt(user.paidUntil)} <span className="text-ink-3 text-xs">{daysUntil(user.paidUntil)}</span></span>
        </div>
        {user.dataDeletesAt && (
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-danger text-sm">Data deletes</span>
            <span className="text-danger text-sm font-semibold">{fmt(user.dataDeletesAt)}</span>
          </div>
        )}
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-ink-3 text-sm">Joined</span>
          <span className="text-ink text-sm">{fmt(user.createdAt)}</span>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 mb-4">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">Actions</p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => act(`/admin/activate/${userId}`, { days: 30 })}
          disabled={!!acting}
          className="w-full bg-[#22C55E15] border border-[#22C55E44] text-[#22C55E] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#22C55E25] transition-colors"
        >
          {acting === `/admin/activate/${userId}` ? 'Activating…' : 'Activate — 1 Month'}
        </button>
        <button
          onClick={() => act(`/admin/activate/${userId}`, { days: 365 })}
          disabled={!!acting}
          className="w-full bg-[#22C55E15] border border-[#22C55E44] text-[#22C55E] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#22C55E25] transition-colors"
        >
          {acting === `/admin/activate/${userId}days365` ? 'Activating…' : 'Activate — 1 Year'}
        </button>
        <button
          onClick={() => act(`/admin/extend/${userId}`, { days: 7 })}
          disabled={!!acting}
          className="w-full bg-[#3B82F615] border border-[#3B82F644] text-[#3B82F6] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#3B82F625] transition-colors"
        >
          {acting === `/admin/extend/${userId}` ? 'Extending…' : 'Extend Grace — 7 Days'}
        </button>

        {user.subscriptionStatus === 'suspended' ? (
          <button
            onClick={() => act(`/admin/unsuspend/${userId}`)}
            disabled={!!acting}
            className="w-full bg-accent/15 border border-accent/40 text-accent font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-accent/25 transition-colors"
          >
            {acting === `/admin/unsuspend/${userId}` ? 'Unsuspending…' : 'Unsuspend Account'}
          </button>
        ) : (
          !user.isAdmin && (
            <button
              onClick={() => act(`/admin/suspend/${userId}`)}
              disabled={!!acting}
              className="w-full bg-[#F59E0B15] border border-[#F59E0B44] text-[#F59E0B] font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#F59E0B25] transition-colors"
            >
              {acting === `/admin/suspend/${userId}` ? 'Suspending…' : 'Suspend Account'}
            </button>
          )
        )}

        {!user.isAdmin && (
          <button
            onClick={handleDelete}
            disabled={!!acting}
            className="w-full bg-danger/10 border border-danger/30 text-danger font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-danger/20 transition-colors mt-2"
          >
            {acting === 'delete' ? 'Deleting…' : 'Delete Account'}
          </button>
        )}
      </div>
    </div>
  )
}
