import { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native' // View used in toast body
import { useToastStore } from '../stores/toast'

export function ToastOverlay() {
  const message = useToastStore((s) => s.message)
  const hide = useToastStore((s) => s.hide)
  const opacity = useRef(new Animated.Value(0)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!message) return

    if (timerRef.current) clearTimeout(timerRef.current)

    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      hide()
    })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [message])

  if (!message) return null

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        opacity,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <View
        style={{
          backgroundColor: '#1E1E1E',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: '#2A2A2A',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 15 }}>✓</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500', flex: 1 }}>{message}</Text>
      </View>
    </Animated.View>
  )
}
