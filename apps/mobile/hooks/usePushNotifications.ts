import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { apiRequest } from '../lib/api'
import { useAuthStore } from '../stores/auth'

// Push tokens are not available in Expo Go since SDK 53 — EAS build only
const isExpoGo = Constants.appOwnership === 'expo'

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

export function usePushNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    // Skip entirely in Expo Go — push tokens require a native build
    if (isExpoGo || !accessToken) return

    async function register() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync()
        let finalStatus = existingStatus

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          finalStatus = status
        }

        if (finalStatus !== 'granted') return

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'TIKNOK Alerts',
            importance: Notifications.AndroidImportance.HIGH,
          })
        }

        const tokenData = await Notifications.getExpoPushTokenAsync()
        const token = tokenData.data

        await apiRequest('/auth/push-token', {
          method: 'POST',
          body: { token },
        })
      } catch {
        // Push registration is best-effort — never block the app
      }
    }

    register()
  }, [accessToken])
}
