import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'

export default function BreederHubScreen() {
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <View style={{
        backgroundColor: '#0A0A0A',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        paddingTop: 52,
        paddingBottom: 12,
        paddingHorizontal: 16,
      }}>
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>Farm OS</Text>
        <Text style={{ color: '#A0A0A0', fontSize: 13, marginTop: 2 }}>Your private farm management tools</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Breeding Records */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/breeder/marking-generator' as any)}
          activeOpacity={0.75}
          style={{
            backgroundColor: '#141414',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#2A2A2A',
            padding: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#1E1E1E',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ fontSize: 24 }}>🏷️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
              Breeding Records
            </Text>
            <Text style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 18 }}>
              Manage seasons, matings, generate markings, and track egg and chick counts.
            </Text>
          </View>
          <Text style={{ color: '#C8A84B', fontSize: 18, marginLeft: 8 }}>›</Text>
        </TouchableOpacity>

        {/* Farm Finance */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/breeder/finance' as any)}
          activeOpacity={0.75}
          style={{
            backgroundColor: '#141414',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#2A2A2A',
            padding: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#1E1E1E',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ fontSize: 24 }}>💰</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
              Farm Finance
            </Text>
            <Text style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 18 }}>
              Track worker salaries, advance requests, and payslip generation.
            </Text>
          </View>
          <Text style={{ color: '#C8A84B', fontSize: 18, marginLeft: 8 }}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}
