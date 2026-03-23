import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
  userId: 'auth_user_id',
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  userId: string | null
  hydrated: boolean
  setTokens: (access: string, refresh: string, userId: string) => Promise<void>
  clearTokens: () => Promise<void>
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  hydrated: false,

  setTokens: async (accessToken, refreshToken, userId) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.accessToken, accessToken),
      SecureStore.setItemAsync(KEYS.refreshToken, refreshToken),
      SecureStore.setItemAsync(KEYS.userId, userId),
    ])
    set({ accessToken, refreshToken, userId })
  },

  clearTokens: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
      SecureStore.deleteItemAsync(KEYS.userId),
    ])
    set({ accessToken: null, refreshToken: null, userId: null })
  },

  hydrate: async () => {
    const [accessToken, refreshToken, userId] = await Promise.all([
      SecureStore.getItemAsync(KEYS.accessToken),
      SecureStore.getItemAsync(KEYS.refreshToken),
      SecureStore.getItemAsync(KEYS.userId),
    ])
    set({ accessToken, refreshToken, userId, hydrated: true })
  },
}))
