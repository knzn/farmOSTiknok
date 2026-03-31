'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

type UserItem = {
  id: string
  username: string
  profilePhoto: string | null
  isBreeder: boolean
  followerCount: number
  isFollowing: boolean
}

export default function ConnectionsPage() {
  const search   = useSearchParams()
  const router   = useRouter()
  const userId   = search.get('userId') ?? ''
  const type     = (search.get('type') ?? 'followers') as 'followers' | 'following'

  const [users, setUsers]           = useState([] as UserItem[])
  const [loading, setLoading]       = useState(true)
  const [followingInFlight, setFollowingInFlight] = useState(new Set<string>())

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    apiRequest(`/users/${userId}/${type}`)
      .then(data => setUsers((data as { users: UserItem[] }).users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId, type])

  async function handleFollow(item: UserItem) {
    if (followingInFlight.has(item.id)) return
    setFollowingInFlight(prev => new Set(prev).add(item.id))
    const action = item.isFollowing ? 'unfollow' : 'follow'
    try {
      await apiRequest(`/users/${item.id}/${action}`, { method: 'POST' })
      setUsers(prev => prev.map(u =>
        u.id === item.id
          ? { ...u, isFollowing: !u.isFollowing, followerCount: u.isFollowing ? u.followerCount - 1 : u.followerCount + 1 }
          : u
      ))
    } catch { /* ignore */ } finally {
      setFollowingInFlight(prev => { const s = new Set(prev); s.delete(item.id); return s })
    }
  }

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="px-6 py-5 border-b border-rim">
        <button onClick={() => router.back()} className="text-accent text-sm hover:opacity-80 mb-3 block">‹ Back</button>
        <h1 className="text-ink text-xl font-bold capitalize">{type}</h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-px px-6 pt-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-rim">
              <div className="w-12 h-12 rounded-full bg-card animate-pulse shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-card rounded animate-pulse mb-1.5" />
                <div className="h-3 w-20 bg-card rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-10 text-center">
          <div className="w-18 h-18 rounded-full bg-card border border-rim flex items-center justify-center mb-5 w-16 h-16">
            <span className="text-3xl">{type === 'followers' ? '👥' : '🔍'}</span>
          </div>
          <p className="text-ink font-semibold text-lg mb-2">
            {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
          </p>
          <p className="text-ink-2 text-sm leading-6 max-w-xs">
            {type === 'followers'
              ? 'Share your posts and interact with the community to grow your following.'
              : 'Follow breeders and enthusiasts to see their posts in your feed.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-rim px-6">
          {users.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-3">
              <Link href={`/profile/${item.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center overflow-hidden shrink-0">
                  {item.profilePhoto
                    ? <img src={item.profilePhoto} alt="" className="w-full h-full object-cover" />
                    : <span className="text-accent font-bold text-lg">{item.username[0]?.toUpperCase()}</span>
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink font-semibold text-sm">@{item.username}</span>
                    {item.isBreeder && <span className="text-xs">🐓</span>}
                  </div>
                  <p className="text-ink-3 text-xs">{item.followerCount} followers</p>
                </div>
              </Link>
              <button
                onClick={() => handleFollow(item)}
                disabled={followingInFlight.has(item.id)}
                className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors min-w-[76px] text-center shrink-0 disabled:opacity-50 ${
                  item.isFollowing
                    ? 'border-rim text-ink-2 hover:border-danger/40 hover:text-danger'
                    : 'bg-accent border-accent text-canvas hover:opacity-90'
                }`}
              >
                {followingInFlight.has(item.id) ? '…' : item.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
