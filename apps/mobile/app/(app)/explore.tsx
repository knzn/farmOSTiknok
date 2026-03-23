/**
 * Explore — Phase 7
 * Breeder / bloodline discovery tool.
 * Search breeders, bloodlines, farms, and top performers by region.
 *
 * The old Instanok photo grid (explore-photos) has been replaced by this screen.
 * Photo feed code is preserved in git history.
 */

import { View, Text } from 'react-native'

export default function ExploreScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 48, marginBottom: 20 }}>🔍</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
        Explore
      </Text>
      <Text style={{ color: '#606060', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
        Discover breeders, bloodlines, and top performers.{'\n'}Coming in Phase 7.
      </Text>
    </View>
  )
}
