import { useAuthStore } from '@/stores/auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  _retry?: boolean
}

async function refreshAccessToken(): Promise<string | null> {
  const store = useAuthStore.getState()
  if (!store.refreshToken) return null

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: store.refreshToken }),
    })
    if (!res.ok) {
      store.clearTokens()
      return null
    }
    const data = await res.json() as { accessToken: string; refreshToken: string }
    store.setTokens(data.accessToken, data.refreshToken, store.userId!)
    return data.accessToken
  } catch {
    store.clearTokens()
    return null
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, _retry = false } = options
  const authToken = token ?? useAuthStore.getState().accessToken

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !_retry) {
    const newToken = await refreshAccessToken()
    if (newToken) return apiRequest<T>(path, { ...options, token: newToken, _retry: true })
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    const message = (error as { message?: string }).message || `HTTP ${res.status}`
    throw new Error(message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
