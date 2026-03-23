import {
  View, Text, TouchableOpacity, RefreshControl,
  ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { apiRequest } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveSeason {
  id: string
  name: string
  year: number
  markingsGenerated: boolean
  matingCount: number
}

interface DashboardData {
  breeding: {
    totalSeasons: number
    activeSeason: ActiveSeason | null
    totalMatings: number
  }
  inventory: {
    stags: number
    pullets: number
    broodHens: number
    chicks: number
    cocks: number
    total: number
    hasData: boolean
  }
  feedBudget: {
    dailyKg: number
    weeklyKg: number
    monthlyKg: number
    monthlyCost: number
    currency: string
    hasData: boolean
  }
  workers: {
    count: number
    monthlyTotal: number
    currency: string
    hasData: boolean
  }
  performance: {
    wins: number
    losses: number
    draws: number
    winRate: number
    bestStag: string | null
    hasData: boolean
  }
}

// ─── Card components ──────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: '#141414',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#2A2A2A',
      padding: 16,
      marginBottom: 12,
    }}>
      {children}
    </View>
  )
}

function CardHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <Text style={{ fontSize: 18, marginRight: 8 }}>{icon}</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 }}>{title}</Text>
      {badge ? (
        <View style={{ backgroundColor: '#22C55E22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600' }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
      <Text style={{ color: '#A0A0A0', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: accent ? '#C8A84B' : '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

function PlaceholderSetup({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ color: '#606060', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          borderWidth: 1,
          borderColor: '#C8A84B',
          borderRadius: 8,
          paddingHorizontal: 20,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>Set Up</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Dashboard cards ──────────────────────────────────────────────────────────

function BreedingCard({ data, onPress }: { data: DashboardData['breeding']; onPress: () => void }) {
  const { activeSeason, totalSeasons, totalMatings } = data
  return (
    <SectionCard>
      <CardHeader
        icon="🐓"
        title="Breeding"
        badge={activeSeason ? (activeSeason.markingsGenerated ? 'Generated' : 'Pending') : undefined}
      />
      {totalSeasons === 0 ? (
        <PlaceholderSetup
          label="No breeding seasons yet. Start your first season to track matings and generate markings."
          onPress={onPress}
        />
      ) : (
        <>
          {activeSeason ? (
            <>
              <StatRow label="Active Season" value={`${activeSeason.name} ${activeSeason.year}`} accent />
              <StatRow label="Matings this season" value={`${activeSeason.matingCount}`} />
            </>
          ) : null}
          <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 8 }} />
          <StatRow label="Total Seasons" value={`${totalSeasons}`} />
          <StatRow label="Total Matings" value={`${totalMatings}`} />
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={{ marginTop: 14, backgroundColor: '#C8A84B22', borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}
          >
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700' }}>Open Breeder →</Text>
          </TouchableOpacity>
        </>
      )}
    </SectionCard>
  )
}

function InventoryCard({ data, onPress }: { data: DashboardData['inventory']; onPress: () => void }) {
  return (
    <SectionCard>
      <CardHeader icon="🏠" title="Farm Inventory" />
      {!data.hasData ? (
        <PlaceholderSetup
          label="Track your stags, pullets, brood hens, and chicks."
          onPress={onPress}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Stags', value: data.stags },
              { label: 'Cocks', value: data.cocks },
              { label: 'Pullets', value: data.pullets },
              { label: 'Brood Hens', value: data.broodHens },
              { label: 'Chicks', value: data.chicks },
            ].map(({ label, value }) => (
              <View key={label} style={{ flex: 1, minWidth: '40%', backgroundColor: '#1E1E1E', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#C8A84B', fontSize: 22, fontWeight: '700' }}>{value}</Text>
                <Text style={{ color: '#A0A0A0', fontSize: 11, marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 10 }} />
          <StatRow label="Total Birds" value={`${data.total}`} accent />
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={{ marginTop: 10, backgroundColor: '#C8A84B22', borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}
          >
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700' }}>Update Inventory →</Text>
          </TouchableOpacity>
        </>
      )}
    </SectionCard>
  )
}

function FeedBudgetCard({ data, onPress }: { data: DashboardData['feedBudget']; onPress: () => void }) {
  return (
    <SectionCard>
      <CardHeader icon="🌾" title="Feed Budget" />
      {!data.hasData ? (
        <PlaceholderSetup
          label="Calculate daily, weekly and monthly feed requirements."
          onPress={onPress}
        />
      ) : (
        <>
          <StatRow label="Daily" value={`${data.dailyKg} kg`} />
          <StatRow label="Weekly" value={`${data.weeklyKg} kg`} />
          <StatRow label="Monthly" value={`${data.monthlyKg} kg`} />
          <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 8 }} />
          <StatRow label="Monthly Cost" value={`${data.currency} ${data.monthlyCost.toLocaleString()}`} accent />
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={{ marginTop: 10, backgroundColor: '#C8A84B22', borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}
          >
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700' }}>Edit Program →</Text>
          </TouchableOpacity>
        </>
      )}
    </SectionCard>
  )
}

function WorkersCard({ data, onPress }: { data: DashboardData['workers']; onPress: () => void }) {
  return (
    <SectionCard>
      <CardHeader icon="👷" title="Workers" />
      {!data.hasData ? (
        <PlaceholderSetup
          label="Track farm workers and monthly payroll."
          onPress={onPress}
        />
      ) : (
        <>
          <StatRow label="Active Workers" value={`${data.count}`} />
          <StatRow label="Monthly Payroll" value={`${data.currency} ${data.monthlyTotal.toLocaleString()}`} accent />
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={{ marginTop: 10, backgroundColor: '#C8A84B22', borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}
          >
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700' }}>Manage Workers →</Text>
          </TouchableOpacity>
        </>
      )}
    </SectionCard>
  )
}

function PerformanceCard({ data, onPress }: { data: DashboardData['performance']; onPress: () => void }) {
  return (
    <SectionCard>
      <CardHeader icon="🏆" title="Fight Performance" />
      {!data.hasData ? (
        <PlaceholderSetup
          label="Record fight results to track win rates and top performers."
          onPress={onPress}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'W', value: data.wins, color: '#22C55E' },
              { label: 'L', value: data.losses, color: '#EF4444' },
              { label: 'D', value: data.draws, color: '#A0A0A0' },
            ].map(({ label, value, color }) => (
              <View key={label} style={{ flex: 1, backgroundColor: '#1E1E1E', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color, fontSize: 22, fontWeight: '700' }}>{value}</Text>
                <Text style={{ color: '#A0A0A0', fontSize: 11, marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
          <StatRow label="Win Rate" value={`${data.winRate.toFixed(1)}%`} accent />
          {data.bestStag ? <StatRow label="Top Stag" value={data.bestStag} /> : null}
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={{ marginTop: 10, backgroundColor: '#C8A84B22', borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}
          >
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700' }}>View Records →</Text>
          </TouchableOpacity>
        </>
      )}
    </SectionCard>
  )
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      {[180, 140, 120, 100, 140].map((h, i) => (
        <View key={i} style={{ height: h, borderRadius: 16, backgroundColor: i % 2 === 0 ? '#141414' : '#1A1A1A', marginBottom: 12 }} />
      ))}
    </View>
  )
}

// ─── Home / Dashboard Screen ──────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter()
  const _userId = useAuthStore(s => s.userId)

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await apiRequest<DashboardData>('/dashboard')
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    }
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const goToBreeder = () => router.push('/(app)/breeder' as any)
  const goToInventory = () => router.push('/(app)/breeder/inventory' as any)
  const goToFeedCalc = () => router.push('/(app)/breeder/feed-calculator' as any)
  const goToWorkers = () => router.push('/(app)/breeder/workers' as any)
  const goToPerformance = () => router.push('/(app)/breeder/performance' as any)

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#0A0A0A',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        paddingTop: 52,
        paddingBottom: 0,
        paddingHorizontal: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Text style={{ color: '#C8A84B', fontSize: 18, fontWeight: '800', letterSpacing: 2, flex: 1 }}>TIKNOK</Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/notifications' as any)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 22 }}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !data ? (
        <DashboardSkeleton />
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: '#A0A0A0', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); load().finally(() => setLoading(false)) }}
            activeOpacity={0.8}
            style={{ backgroundColor: '#C8A84B22', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 }}
          >
            <Text style={{ color: '#C8A84B', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A84B" />}
          showsVerticalScrollIndicator={false}
        >
          {data ? (
            <>
              <BreedingCard data={data.breeding} onPress={goToBreeder} />
              <InventoryCard data={data.inventory} onPress={goToInventory} />
              <FeedBudgetCard data={data.feedBudget} onPress={goToFeedCalc} />
              <WorkersCard data={data.workers} onPress={goToWorkers} />
              <PerformanceCard data={data.performance} onPress={goToPerformance} />
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}
