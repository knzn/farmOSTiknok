'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '@/stores/auth'
import { apiRequest } from '@/lib/api'

type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: { _id: string }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

function RegisterForm() {
  const [showEmailForm, setShowEmailForm]     = useState(false)
  const [username, setUsername]               = useState('')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isBreeder, setIsBreeder]             = useState(false)
  const [showPassword, setShowPassword]       = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [googleLoading, setGoogleLoading]     = useState(false)

  const setTokens = useAuthStore(s => s.setTokens)
  const router    = useRouter()

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      setError(null)
      try {
        const data = await apiRequest<AuthResponse>('/auth/google', {
          method: 'POST',
          body: { accessToken: tokenResponse.access_token },
        })
        setTokens(data.accessToken, data.refreshToken, data.user._id)
        router.replace('/dashboard')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Google sign in failed')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => setError('Google sign in was cancelled'),
  })

  async function handleRegister() {
    setError(null)
    if (!username.trim())                       return setError('Username is required')
    if (!/^[a-z0-9_]+$/.test(username.trim())) return setError('Username: lowercase, numbers, underscores only')
    if (username.trim().length < 3)             return setError('Username must be at least 3 characters')
    if (!email.trim())                          return setError('Email is required')
    if (password.length < 8)                    return setError('Password must be at least 8 characters')
    if (password !== confirmPassword)           return setError('Passwords do not match')

    setLoading(true)
    try {
      const data = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { username: username.trim().toLowerCase(), email: email.trim().toLowerCase(), password, isBreeder },
      })
      setTokens(data.accessToken, data.refreshToken, data.user._id)
      router.replace('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Brand */}
      <div className="flex flex-col items-center mb-8">
        <div className="text-4xl font-black tracking-tight text-accent mb-2">TIKNOK</div>
        <p className="text-ink-2 text-sm">Create your account</p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-md px-4 py-3">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {/* Google — primary CTA */}
      <button
        onClick={() => googleLogin()}
        disabled={googleLoading}
        className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold text-base rounded-full py-4 flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
      >
        {googleLoading ? (
          <span className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
        ) : (
          <>
            <span className="text-lg font-black">G</span>
            Continue with Google
          </>
        )}
      </button>

      {/* Email toggle */}
      <button
        onClick={() => { setShowEmailForm(v => !v); setError(null) }}
        className="text-ink-3 text-sm text-center py-2 hover:text-ink-2 transition-colors"
      >
        {showEmailForm ? '▲ Hide email sign up' : 'or sign up with email'}
      </button>

      {/* Email form */}
      {showEmailForm && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center bg-card border border-rim rounded-md px-4">
            <span className="text-ink-3 mr-3">👤</span>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              className="flex-1 bg-transparent text-ink text-base py-4 outline-none placeholder:text-ink-3"
            />
          </div>
          <div className="flex items-center bg-card border border-rim rounded-md px-4">
            <span className="text-ink-3 mr-3">@</span>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-ink text-base py-4 outline-none placeholder:text-ink-3"
            />
          </div>
          <div className="flex items-center bg-card border border-rim rounded-md px-4">
            <span className="text-ink-3 mr-3">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (8+ characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-ink text-base py-4 outline-none placeholder:text-ink-3"
            />
            <button onClick={() => setShowPassword(v => !v)} className="text-ink-3 text-sm hover:text-ink-2">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex items-center bg-card border border-rim rounded-md px-4">
            <span className="text-ink-3 mr-3">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              className="flex-1 bg-transparent text-ink text-base py-4 outline-none placeholder:text-ink-3"
            />
          </div>

          {/* Breeder toggle */}
          <div
            className="flex items-center bg-card border border-rim rounded-md px-4 py-4 cursor-pointer"
            onClick={() => setIsBreeder(v => !v)}
          >
            <span className="text-2xl mr-3">🐓</span>
            <div className="flex-1">
              <p className="text-ink font-semibold text-base">I&apos;m a Breeder</p>
              <p className="text-ink-2 text-sm">Unlocks the Breeder module</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors ${isBreeder ? 'bg-accent' : 'bg-rim'} relative`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isBreeder ? 'left-7' : 'left-1'}`} />
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-accent hover:opacity-90 text-canvas font-bold text-base rounded-full py-4 transition-opacity disabled:opacity-60"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-canvas/40 border-t-canvas rounded-full animate-spin mx-auto block" />
            ) : 'Create Account'}
          </button>
        </div>
      )}

      {/* Login link */}
      <p className="text-center text-ink-2 text-sm mt-4">
        Already have an account?{' '}
        <Link href="/login" className="text-accent font-bold hover:opacity-80">
          Sign In
        </Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <RegisterForm />
    </GoogleOAuthProvider>
  )
}
