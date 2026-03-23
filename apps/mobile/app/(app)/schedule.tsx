/**
 * Schedule — Phase 6
 * Derby event calendar, registration, and results.
 */

import { View, Text } from 'react-native'

export default function ScheduleScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 48, marginBottom: 20 }}>📅</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
        Derby Schedule
      </Text>
      <Text style={{ color: '#606060', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
        Upcoming derbies, event registration,{'\n'}and results.{'\n'}Coming in Phase 6.
      </Text>
    </View>
  )
}
