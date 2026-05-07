'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Cookie storage (30-day expiry, survives browser close) ──────────────────

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days in seconds

function makeCookieStorage() {
  return {
    getItem: (name: string): string | null => {
      if (typeof document === 'undefined') return null
      const match = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${name}=`))
      return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
    },
    setItem: (name: string, value: string): void => {
      if (typeof document === 'undefined') return
      document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
    },
    removeItem: (name: string): void => {
      if (typeof document === 'undefined') return
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
      storage: createJSONStorage(makeCookieStorage),
    },
  ),
)
