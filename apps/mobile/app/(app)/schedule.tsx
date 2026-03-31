import { View, Text } from 'react-native'

export default function ScheduleScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <Text style={{ fontSize: 52, marginBottom: 20 }}>📅</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 }}>
        Derby Schedule
      </Text>
      <Text style={{ color: '#606060', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
        Track upcoming derbies, register your birds, and log results.
      </Text>
      <View style={{ marginTop: 28, backgroundColor: '#C8A84B20', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: '#C8A84B40' }}>
        <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>Coming Soon</Text>
      </View>
    </View>
  )
}
