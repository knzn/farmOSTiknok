'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Hybrid storage: localStorage primary (iOS PWA-safe, not ITP-capped) ─────
// iOS Safari ITP caps document.cookie JS-set cookies to 7 days regardless of
// max-age. localStorage in a PWA is NOT affected by ITP and persists until the
// app is uninstalled. Writing to both means regular browsers keep the cookie
// fallback, and iOS PWA relies on the localStorage copy.

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days in seconds

function makeHybridStorage() {
  return {
    getItem: (name: string): string | null => {
      if (typeof window === 'undefined') return null
      try {
        const ls = window.localStorage.getItem(name)
        if (ls) return ls
      } catch {}
      const match = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${name}=`))
      return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
    },
    setItem: (name: string, value: string): void => {
      if (typeof window === 'undefined') return
      try { window.localStorage.setItem(name, value) } catch {}
      document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
    },
    removeItem: (name: string): void => {
      if (typeof window === 'undefined') return
      try { window.localStorage.removeItem(name) } catch {}
      document.cookie = `${name}=; max-age=0; path=/`
    },
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  userId: string | null
  setTokens: (accessToken: string, refreshToken: string, userId: string) => void
  clearTokens: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken:  null,
      refreshToken: null,
      userId:       null,
      setTokens: (accessToken, refreshToken, userId) =>
        set({ accessToken, refreshToken, userId }),
      clearTokens: () =>
        set({ accessToken: null, refreshToken: null, userId: null }),
    }),
    {
      name:    'tiknok-auth',
      storage: createJSONStorage(makeHybridStorage),
    },
  ),
)
