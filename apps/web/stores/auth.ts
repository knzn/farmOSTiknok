'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
    { name: 'tiknok-auth' },
  ),
)
