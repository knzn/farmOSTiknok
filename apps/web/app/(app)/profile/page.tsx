'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { apiRequest } from '@/lib/api'

interface Me {
  username: string
  email: string
  profilePhoto: string | null
  bio: string
  location: string
  isBreeder: boolean
  tiknokId: string | null
  subscriptionStatus: string
  isAdmin: boolean
  hasPassword: boolean
  accountSecuredAt: string | null
  authProviders: string[]
}

export default function ProfilePage() {
  const clearTokens = useAuthStore(s => s.clearTokens)
  const router      = useRouter()
  const [me, setMe]           = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<Me>('/auth/me')
      setMe(data)
    } catch {
      clearTokens()
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }, [clearTokens, router])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-6">
        <div className="w-20 h-20 rounded-full bg-card animate-pulse mb-4" />
        <div className="h-5 w-32 bg-card rounded animate-pulse mb-2" />
        <div className="h-4 w-48 bg-card rounded animate-pulse" />
      </div>
    )
  }

  if (!me) return null

  const statusColor = me.subscriptionStatus === 'active'
    ? 'bg-success/20 text-success'
    : me.subscriptionStatus === 'trial'
    ? 'bg-accent/20 text-accent'
    : 'bg-danger/20 text-danger'

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-ink text-2xl font-bold mb-6">Profile</h1>

      {/* Avatar + info */}
      <div className="bg-card border border-rim rounded-xl p-5 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent">
            {me.profilePhoto
              ? <img src={me.profilePhoto} className="w-16 h-16 rounded-full object-cover" alt="" />
              : me.username[0].toUpperCase()
            }
          </div>
          <div>
            <p className="text-ink font-bold text-lg">@{me.username}</p>
            <p className="text-ink-2 text-sm">{me.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {me.tiknokId && (
            <span className="bg-accent/20 text-accent text-xs font-bold px-2.5 py-1 rounded-md">{me.tiknokId}</span>
          )}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase ${statusColor}`}>
            {me.subscriptionStatus === 'active' ? 'Pro' : me.subscriptionStatus}
          </span>
          {me.isBreeder && <span className="text-xs font-bold bg-card-2 text-ink-2 px-2.5 py-1 rounded-md">🐓 Breeder</span>}
          {me.isAdmin && <span className="text-xs font-bold bg-warning/20 text-warning px-2.5 py-1 rounded-md">Admin</span>}
        </div>

        {me.bio ? <p className="text-ink-2 text-sm mt-3">{me.bio}</p> : null}
        {me.location ? <p className="text-ink-3 text-sm mt-1">📍 {me.location}</p> : null}
      </div>

      {/* Security */}
      {!me.hasPassword && !me.accountSecuredAt && (
        <div className="bg-info/10 border border-info/30 rounded-xl p-4 mb-4 flex items-center gap-3">
          <span className="text-xl">🔐</span>
          <div className="flex-1">
            <p className="text-info font-semibold text-sm">Secure your account</p>
            <p className="text-info/70 text-xs mt-0.5">Add a password so you can always log in</p>
          </div>
        </div>
      )}

      {/* Edit Profile */}
      <button
        onClick={() => router.push('/profile/edit')}
        className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3 text-sm mb-3 transition-opacity"
      >
        Edit Profile
      </button>

      {/* Admin */}
      {me.isAdmin && (
        <button
          onClick={() => router.push('/admin')}
          className="w-full bg-accent/15 border border-accent/30 rounded-xl py-3 text-accent font-bold text-sm mb-3 hover:bg-accent/20 transition-colors"
        >
          ⚙️ Admin Panel
        </button>
      )}

      {/* Sign out */}
      <button
        onClick={() => { clearTokens(); router.replace('/login') }}
        className="w-full text-danger text-sm font-semibold py-3 hover:opacity-80 transition-opacity"
      >
        Sign Out
      </button>
    </div>
  )
}
