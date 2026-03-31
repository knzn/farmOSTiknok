'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

type UserProfile = {
  id: string
  username: string
  profilePhoto: string | null
  coverPhoto: string | null
  bio: string
  location: string
  isBreeder: boolean
  followerCount: number
  followingCount: number
  isFollowing: boolean
}

export default function UserProfilePage() {
  const params        = useParams()
  const router        = useRouter()
  const currentUserId = useAuthStore(s => s.userId)
  const clearTokens   = useAuthStore(s => s.clearTokens)

  const userId = params.userId as string
  const isMe   = userId === 'me' || userId === currentUserId

  const [profile, setProfile]             = useState(null as UserProfile | null)
  const [tiknokId, setTiknokId]           = useState(null as string | null)
  const [subscriptionStatus, setSubStatus] = useState(null as string | null)
  const [isAdmin, setIsAdmin]             = useState(false)
  const [loading, setLoading]             = useState(true)
  const [following, setFollowing]         = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError]                 = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const targetId = isMe ? currentUserId : userId
      const reqs: Promise<unknown>[] = [
        apiRequest(`/users/${targetId}`),
      ]
      if (isMe) reqs.push(apiRequest('/auth/me'))

      const [profileData, meData] = await Promise.all(reqs) as [UserProfile, { tiknokId?: string; subscriptionStatus?: string; isAdmin?: boolean } | undefined]
      setProfile(profileData)
      setFollowing(profileData.isFollowing)
      if (meData) {
        setTiknokId(meData.tiknokId ?? null)
        setSubStatus(meData.subscriptionStatus ?? null)
        setIsAdmin(meData.isAdmin ?? false)
      }
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [isMe, userId, currentUserId])

  useEffect(() => { load() }, [load])

  async function handleFollow() {
    if (!profile || followLoading) return
    setFollowLoading(true)
    try {
      await apiRequest(`/users/${profile.id}/${following ? 'unfollow' : 'follow'}`, { method: 'POST' })
      setFollowing(f => !f)
      setProfile(p => p ? {
        ...p,
        followerCount: following ? p.followerCount - 1 : p.followerCount + 1,
        isFollowing: !following,
      } : p)
    } catch { /* ignore */ } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl">
        <div className="w-full h-36 bg-card animate-pulse" />
        <div className="px-5 pt-3">
          <div className="w-20 h-20 rounded-full bg-card animate-pulse -mt-10 mb-3 border-4 border-canvas" />
          <div className="h-5 w-36 bg-card rounded animate-pulse mb-2" />
          <div className="h-4 w-24 bg-card rounded animate-pulse mb-5" />
          <div className="flex gap-4 mb-5">
            {[1,2,3].map(i => <div key={i} className="flex-1 h-10 bg-card rounded-lg animate-pulse" />)}
          </div>
          <div className="h-11 bg-card rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="text-accent text-sm hover:opacity-80 mb-4 block">‹ Back</button>
        <p className="text-danger text-sm">{error}</p>
      </div>
    )
  }

  if (!profile) return null

  const subColor = subscriptionStatus === 'active'
    ? 'bg-[#22C55E22] text-[#22C55E]'
    : subscriptionStatus === 'trial'
    ? 'bg-accent/15 text-accent'
    : 'bg-danger/15 text-danger'

  return (
    <div className="max-w-xl">
      {/* Cover */}
      <div className="relative w-full h-36 bg-card">
        {profile.coverPhoto
          ? <img src={profile.coverPhoto} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-[#1A1A1A]" />
        }
        {userId !== 'me' && (
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 bg-black/50 text-white text-sm font-semibold px-3 py-1.5 rounded-full hover:bg-black/70 transition-colors"
          >
            ‹ Back
          </button>
        )}
      </div>

      {/* Info */}
      <div className="px-5 pb-6 border-b border-rim">
        {/* Avatar */}
        <div className="flex items-end justify-between -mt-10 mb-3">
          <div className="w-20 h-20 rounded-full bg-accent/15 border-4 border-canvas flex items-center justify-center overflow-hidden shrink-0">
            {profile.profilePhoto
              ? <img src={profile.profilePhoto} alt="" className="w-full h-full object-cover" />
              : <span className="text-accent text-2xl font-black">{profile.username[0]?.toUpperCase()}</span>
            }
          </div>
        </div>

        {/* Username */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-ink text-xl font-bold">@{profile.username}</span>
          {profile.isBreeder && <span>🐓</span>}
        </div>

        {/* TK-ID + subscription (own profile only) */}
        {isMe && tiknokId && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-accent/15 text-accent text-xs font-bold px-2 py-0.5 rounded">{tiknokId}</span>
            {subscriptionStatus && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${subColor}`}>
                {subscriptionStatus === 'active' ? 'Pro' : subscriptionStatus}
              </span>
            )}
          </div>
        )}

        {profile.location && <p className="text-ink-2 text-sm mb-2">📍 {profile.location}</p>}
        {profile.bio      && <p className="text-ink-2 text-sm mb-4 leading-5">{profile.bio}</p>}

        {/* Stats */}
        <div className="flex mb-5">
          <div className="flex-1 flex flex-col items-center py-2">
            <span className="text-ink font-bold text-lg">—</span>
            <span className="text-ink-3 text-xs mt-0.5">Posts</span>
          </div>
          <div className="w-px bg-rim my-1" />
          <Link
            href={`/profile/connections?userId=${profile.id}&type=followers`}
            className="flex-1 flex flex-col items-center py-2 hover:bg-card/50 transition-colors"
          >
            <span className="text-ink font-bold text-lg">{profile.followerCount}</span>
            <span className="text-ink-3 text-xs mt-0.5">Followers</span>
          </Link>
          <div className="w-px bg-rim my-1" />
          <Link
            href={`/profile/connections?userId=${profile.id}&type=following`}
            className="flex-1 flex flex-col items-center py-2 hover:bg-card/50 transition-colors"
          >
            <span className="text-ink font-bold text-lg">{profile.followingCount}</span>
            <span className="text-ink-3 text-xs mt-0.5">Following</span>
          </Link>
        </div>

        {/* Action buttons */}
        {isMe ? (
          <div className="flex flex-col gap-2">
            <Link
              href="/profile/edit"
              className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3 text-sm text-center transition-opacity"
            >
              Edit Profile
            </Link>
            <Link
              href="/breeder"
              className="w-full bg-card border border-rim hover:border-accent/30 text-ink font-semibold rounded-xl py-3 text-sm text-center transition-colors"
            >
              🐓  Breeder Module
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="w-full bg-accent/15 border border-accent/30 hover:bg-accent/25 text-accent font-bold rounded-xl py-3 text-sm text-center transition-colors"
              >
                ⚙️  Admin Panel
              </Link>
            )}
            <button
              onClick={() => { clearTokens(); router.replace('/login') }}
              className="w-full text-danger text-sm font-semibold py-3 hover:opacity-80 transition-opacity"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors border disabled:opacity-60 ${
              following
                ? 'bg-transparent border-rim text-ink-2 hover:border-danger/40 hover:text-danger'
                : 'bg-accent border-accent text-canvas hover:opacity-90'
            }`}
          >
            {followLoading ? '…' : following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Posts placeholder */}
      <div className="flex flex-col items-center py-20 text-center px-8">
        <span className="text-5xl mb-4">📷</span>
        <p className="text-ink-2 text-sm">No posts yet</p>
      </div>
    </div>
  )
}
