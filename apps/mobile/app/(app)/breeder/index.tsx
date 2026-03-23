import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'

type Feature = {
  id: string
  title: string
  description: string
  icon: string
  route: string
  available: boolean
}

const FEATURES: Feature[] = [
  {
    id: 'marking-generator',
    title: 'Breeding Records',
    description: 'Manage seasons, matings, generate markings, and track egg and chick counts.',
    icon: '🏷️',
    route: '/(app)/breeder/marking-generator',
    available: true,
  },
  {
    id: 'inventory',
    title: 'Farm Inventory',
    description: 'Track your stags, pullets, brood hens, chicks, and cocks by count.',
    icon: '🏠',
    route: '/(app)/breeder/inventory',
    available: true,
  },
  {
    id: 'feed-calculator',
    title: 'Feed Calculator',
    description: 'Calculate daily, weekly, and monthly feed requirements and budget.',
    icon: '🌾',
    route: '/(app)/breeder/feed-calculator',
    available: true,
  },
  {
    id: 'workers',
    title: 'Worker Manager',
    description: 'Track farm workers, daily rates, and monthly payroll.',
    icon: '👷',
    route: '/(app)/breeder/workers',
    available: true,
  },
  {
    id: 'performance',
    title: 'Fight Performance',
    description: 'Log fight results and track win rates by stag and bloodline.',
    icon: '🏆',
    route: '/(app)/breeder/performance',
    available: true,
  },
  {
    id: 'birds',
    title: 'Bird Profiles',
    description: 'Individual bird records — bloodline, marking, weight, status, and lineage.',
    icon: '🐓',
    route: '/(app)/breeder/birds',
    available: true,
  },
]

export default function BreederHubScreen() {
  const router = useRouter()

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-5 pt-16 pb-4">
        <Text className="text-ink text-2xl font-bold">Breeder</Text>
        <Text className="text-ink-2 text-sm mt-1">Your private breeding management tools</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-3">
          Features
        </Text>

        {FEATURES.map((feature) => (
          <TouchableOpacity
            key={feature.id}
            className={`bg-card rounded-xl p-4 mb-3 border ${
              feature.available ? 'border-rim' : 'border-rim'
            } flex-row items-center`}
            onPress={() => feature.available && router.push(feature.route as any)}
            activeOpacity={feature.available ? 0.7 : 1}
          >
            <View className="w-12 h-12 rounded-xl bg-canvas items-center justify-center mr-4">
              <Text style={{ fontSize: 24 }}>{feature.icon}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-0.5">
                <Text className={`font-semibold text-base ${feature.available ? 'text-ink' : 'text-ink-2'}`}>
                  {feature.title}
                </Text>
                {!feature.available && (
                  <View className="bg-rim rounded-full px-2 py-0.5">
                    <Text className="text-ink-2 text-xs">Soon</Text>
                  </View>
                )}
              </View>
              <Text className="text-ink-2 text-sm leading-5" numberOfLines={2}>
                {feature.description}
              </Text>
            </View>
            {feature.available && (
              <Text className="text-accent text-lg ml-2">›</Text>
            )}
          </TouchableOpacity>
        ))}

        <View className="h-8" />
      </ScrollView>
    </View>
  )
}
