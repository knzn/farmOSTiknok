import { useEffect, useState } from 'react'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { useAuthStore } from '../stores/auth'
import { apiRequest } from '../lib/api'

WebBrowser.maybeCompleteAuthSession()

const ANDROID_CLIENT_ID = '593043566086-2gp9li3b9tmnrnn6qsgrpr6km63u0dto.apps.googleusercontent.com'
const WEB_CLIENT_ID     = '593043566086-bnst6v6jkdssq1eccehbclklms68kn5e.apps.googleusercontent.com'

type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: { _id: string }
}

export function useGoogleSignIn(onSuccess: () => void) {
  const setTokens = useAuthStore((s) => s.setTokens)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId:     WEB_CLIENT_ID,
    redirectUri:     'com.tiknok.app:/oauthredirect',
  })

  useEffect(() => {
    if (response?.type !== 'success') return

    const accessToken = response.authentication?.accessToken
    if (!accessToken) return

    async function finish() {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<AuthResponse>('/auth/google', {
          method: 'POST',
          body: { accessToken },
        })
        await setTokens(data.accessToken, data.refreshToken, data.user._id)
        onSuccess()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Google sign-in failed')
      } finally {
        setLoading(false)
      }
    }

    finish()
  }, [response])

  function signIn() {
    setError(null)
    promptAsync()
  }

  return { signIn, loading: loading || !request, error }
}
