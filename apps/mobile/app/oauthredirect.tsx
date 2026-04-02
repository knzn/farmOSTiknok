import { useEffect } from 'react'
import { View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'

// This route handles the OAuth redirect from Google (tiknok://oauthredirect?code=...)
// maybeCompleteAuthSession() signals expo-auth-session to complete the flow
export default function OAuthRedirect() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession()
  }, [])

  return <View />
}
