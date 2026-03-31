import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'

export default function FinanceHubScreen() {
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: 8 }}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>← Farm OS</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>Farm Finance</Text>
        <Text style={{ color: '#A0A0A0', fontSize: 13, marginTop: 2 }}>Track salaries, advances, and expenses</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Workers / Salary */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/breeder/finance/workers' as any)}
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
            <Text style={{ fontSize: 24 }}>👷</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
              Worker Salary
            </Text>
            <Text style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 18 }}>
              Manage workers, monthly salary, advance requests, and payslip export.
            </Text>
          </View>
          <Text style={{ color: '#C8A84B', fontSize: 18, marginLeft: 8 }}>›</Text>
        </TouchableOpacity>

        {/* Farm Expenses */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/breeder/finance/expenses' as any)}
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
            <Text style={{ fontSize: 24 }}>🧾</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
              Farm Expenses
            </Text>
            <Text style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 18 }}>
              Track feeds, vitamins, medicines, deworming, and other farm costs.
            </Text>
          </View>
          <Text style={{ color: '#C8A84B', fontSize: 18, marginLeft: 8 }}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}
