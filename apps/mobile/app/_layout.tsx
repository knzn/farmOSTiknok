import '../global.css'
import { Stack, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View, Text } from 'react-native'
import { useAuthStore } from '../stores/auth'

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
      <Text style={{ color: '#C8A84B', fontSize: 56, fontWeight: '800', letterSpacing: -1 }}>T</Text>
      <Text style={{ color: '#C8A84B', fontSize: 16, fontWeight: '600', letterSpacing: 4, marginTop: 4 }}>
        TIKNOK
      </Text>
    </View>
  )
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const hydrated = useAuthStore((s) => s.hydrated)

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
    </GestureHandlerRootView>
  )
}
