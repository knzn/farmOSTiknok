'use client'
import { useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (!email.trim()) return setError('Email is required')
    setLoading(true)
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-5xl">📬</div>
        <h2 className="text-ink text-xl font-bold">Check your inbox</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          We sent a reset link to <span className="text-ink font-semibold">{email}</span>.
          It expires in 1 hour.
        </p>
        <Link href="/login" className="text-accent font-bold text-sm hover:opacity-80 mt-4">
          ← Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center mb-6">
        <div className="text-4xl font-black tracking-tight text-accent mb-2">TIKNOK</div>
        <h2 className="text-ink text-lg font-bold">Reset your password</h2>
        <p className="text-ink-2 text-sm mt-1">We&apos;ll send a reset link to your email.</p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-md px-4 py-3">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center bg-card border border-rim rounded-md px-4">
        <span className="text-ink-3 mr-3">@</span>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="flex-1 bg-transparent text-ink text-base py-4 outline-none placeholder:text-ink-3"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-accent hover:opacity-90 text-canvas font-bold text-base rounded-full py-4 transition-opacity disabled:opacity-60"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-canvas/40 border-t-canvas rounded-full animate-spin mx-auto block" />
        ) : 'Send Reset Link'}
      </button>

      <Link href="/login" className="text-ink-3 text-sm text-center hover:text-ink-2 mt-2">
        ← Back to Sign In
      </Link>
    </div>
  )
}
