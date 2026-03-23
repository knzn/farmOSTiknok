import { View, Text } from 'react-native'

export default function NotificationsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F11' }}>
      {/* Header */}
      <View style={{
        paddingTop: 58, paddingBottom: 16, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: '#27272A',
      }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>Notifications</Text>
      </View>

      {/* Empty state */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A',
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Text style={{ fontSize: 36 }}>🔔</Text>
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>
          No notifications yet
        </Text>
        <Text style={{ color: '#A1A1AA', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
          When someone likes or comments on your posts, or starts following you, it will show up here.
        </Text>
      </View>
    </View>
  )
}
