'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

type Me = {
  username: string
  bio: string
  location: string
  profilePhoto: string | null
  coverPhoto: string | null
}

const USERNAME_RE = /^[a-z0-9_]{3,30}$/

export default function ProfileEditPage() {
  const router      = useRouter()
  const accessToken = useAuthStore(s => s.accessToken)

  const [username, setUsername] = useState('')
  const [bio, setBio]           = useState('')
  const [location, setLocation] = useState('')
  const [profilePhoto, setProfilePhoto] = useState(null as string | null)
  const [coverPhoto, setCoverPhoto]     = useState(null as string | null)

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [uploadingAvatar, setUploadingAvatar]   = useState(false)
  const [uploadingCover, setUploadingCover]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  const avatarInputRef = useRef(null as HTMLInputElement | null)
  const coverInputRef  = useRef(null as HTMLInputElement | null)

  useEffect(() => {
    apiRequest('/auth/me')
      .then(data => {
        const m = data as Me
        setUsername(m.username ?? '')
        setBio(m.bio ?? '')
        setLocation(m.location ?? '')
        setProfilePhoto(m.profilePhoto ?? null)
        setCoverPhoto(m.coverPhoto ?? null)
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  async function uploadPhoto(file: File, endpoint: string, setter: (url: string | null) => void, setBusy: (v: boolean) => void) {
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('photo', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message ?? 'Upload failed')
      }
      const data = await res.json() as { profilePhoto?: string; coverPhoto?: string }
      setter(data.profilePhoto ?? data.coverPhoto ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!USERNAME_RE.test(username)) {
      return setError('Username must be 3–30 chars: lowercase letters, numbers, underscores only')
    }
    if (bio.length > 150)      return setError('Bio max 150 characters')
    if (location.length > 60)  return setError('Location max 60 characters')

    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await apiRequest('/users/me', { method: 'PATCH', body: { username, bio, location } })
      setSuccess(true)
      setTimeout(() => router.push(`/profile/me`), 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-xl">
        <div className="h-4 w-24 bg-card rounded animate-pulse mb-6" />
        <div className="h-32 bg-card rounded-xl animate-pulse mb-4" />
        {[1,2,3].map(i => <div key={i} className="h-14 bg-card rounded-xl animate-pulse mb-3" />)}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl">
      <Link href="/profile/me" className="text-accent text-sm hover:opacity-80">‹ Back to Profile</Link>
      <h1 className="text-ink text-2xl font-bold mt-1 mb-6">Edit Profile</h1>

      {/* Cover photo */}
      <div className="mb-5">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Cover Photo</label>
        <div
          className="relative w-full h-32 bg-card border border-rim rounded-xl overflow-hidden cursor-pointer group"
          onClick={() => coverInputRef.current?.click()}
        >
          {coverPhoto
            ? <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-ink-3 text-sm">No cover</div>
          }
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-sm font-semibold">{uploadingCover ? 'Uploading…' : 'Change Cover'}</span>
          </div>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) uploadPhoto(file, '/users/me/cover', setCoverPhoto, setUploadingCover)
            e.target.value = ''
          }}
        />
      </div>

      {/* Avatar */}
      <div className="mb-6">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Profile Photo</label>
        <div className="flex items-center gap-4">
          <div
            className="relative w-20 h-20 rounded-full bg-accent/15 border border-rim overflow-hidden cursor-pointer group shrink-0"
            onClick={() => avatarInputRef.current?.click()}
          >
            {profilePhoto
              ? <img src={profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-accent text-2xl font-black">
                  {username[0]?.toUpperCase() ?? '?'}
                </div>
            }
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              <span className="text-white text-xs font-semibold">{uploadingAvatar ? '…' : '✎'}</span>
            </div>
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="text-accent text-sm font-semibold hover:opacity-80 disabled:opacity-50"
          >
            {uploadingAvatar ? 'Uploading…' : 'Change photo'}
          </button>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) uploadPhoto(file, '/users/me/avatar', setProfilePhoto, setUploadingAvatar)
            e.target.value = ''
          }}
        />
      </div>

      {/* Username */}
      <div className="mb-5">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Username</label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase())}
          placeholder="your_username"
          className="w-full bg-card border border-rim rounded-xl px-4 py-3.5 text-ink outline-none focus:border-accent placeholder:text-ink-3"
        />
        <p className="text-ink-3 text-xs mt-1.5">3–30 chars. Lowercase letters, numbers, underscores only.</p>
      </div>

      {/* Bio */}
      <div className="mb-5">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">
          Bio <span className="text-ink-3 font-normal normal-case">({bio.length}/150)</span>
        </label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
          maxLength={150}
          placeholder="Tell breeders about yourself…"
          className="w-full bg-card border border-rim rounded-xl px-4 py-3.5 text-ink outline-none focus:border-accent placeholder:text-ink-3 resize-none"
        />
      </div>

      {/* Location */}
      <div className="mb-6">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Location</label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="e.g. Bulacan, Philippines"
          maxLength={60}
          className="w-full bg-card border border-rim rounded-xl px-4 py-3.5 text-ink outline-none focus:border-accent placeholder:text-ink-3"
        />
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 mb-4">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-[#22C55E15] border border-[#22C55E44] rounded-xl px-4 py-3 mb-4">
          <p className="text-[#22C55E] text-sm font-semibold">Profile saved!</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || uploadingAvatar || uploadingCover}
        className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-4 transition-opacity disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
