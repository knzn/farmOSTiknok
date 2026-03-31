import '../global.css'
import { Stack, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View, Text, Image } from 'react-native'
import { useAuthStore } from '../stores/auth'
import { ToastOverlay } from '../components/ToastOverlay'
import { PaywallModal } from '../components/PaywallModal'
import { usePushNotifications } from '../hooks/usePushNotifications'

function AuthGuard() {
  const { accessToken, hydrated } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!hydrated) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (accessToken && inAuthGroup) {
      router.replace('/(app)')
    }
  }, [accessToken, hydrated, segments])

  return null
}

function SplashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={require('../assets/symbol.png')}
        style={{ width: 160, height: 160 }}
        resizeMode="contain"
      />
      <Image
        source={require('../assets/wordmark.png')}
        style={{ width: 220, height: 60, marginTop: 24 }}
        resizeMode="contain"
      />
    </View>
  )
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const hydrated = useAuthStore((s) => s.hydrated)
  usePushNotifications()

  useEffect(() => {
    hydrate()
  }, [])

  if (!hydrated) return <SplashScreen />

  return (
    <GestureHandlerRootView className="flex-1">
      <StatusBar style="light" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <ToastOverlay />
      <PaywallModal />
    </GestureHandlerRootView>
  )
}
