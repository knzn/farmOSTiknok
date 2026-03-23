import { Stack } from 'expo-router'
import { useNavigation } from 'expo-router'
import { useEffect } from 'react'

export default function BreederLayout() {
  const navigation = useNavigation()

  useEffect(() => {
    // Hide the bottom tab bar while inside the Breeder module
    const parent = navigation.getParent()
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: 'none' } })
      return () => {
        parent.setOptions({ tabBarStyle: undefined })
      }
    }
  }, [navigation])

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0A0A' },
        headerTintColor: '#C8A84B',
        headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' },
        headerBackTitle: '',
        contentStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Breeder', headerShown: false }} />
      <Stack.Screen name="marking-generator/index" options={{ headerShown: false }} />
      <Stack.Screen name="marking-generator/[seasonId]/index" options={{ headerShown: false }} />
      <Stack.Screen name="marking-generator/[seasonId]/mating/create" options={{ title: 'New Mating', headerBackTitle: 'Season' }} />
      <Stack.Screen name="marking-generator/[seasonId]/mating/edit" options={{ title: 'Edit Mating', headerBackTitle: 'Season' }} />
      <Stack.Screen name="marking-generator/generate/[seasonId]" options={{ title: 'Generate Markings' }} />
    </Stack>
  )
}
