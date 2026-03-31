import {
  View, Text, TouchableOpacity, RefreshControl,
  ScrollView, Dimensions, Image,
} from 'react-native'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { apiRequest } from '../../lib/api'
import { SecureAccountSheet } from '../../components/SecureAccountSheet'

const SCREEN_W = Dimensions.get('window').width
const CARD_W = SCREEN_W - 32 // 16px padding each side

// ─── types ────────────────────────────────────────────────────────────────────

interface ActiveSeason {
  id: string
  name: string
  year: number
  markingsGenerated: boolean
  matingCount: number
  eggsLaid: number | null
  chicksHatched: number | null
  hatchRate: number | null
  sexCountDone: boolean
  expectedHatchDate: string | null
}

interface FinanceData {
  totalWorkers: number
  totalSalaryDue: number
  totalAdvancesThisMonth: number
  unpaidWorkers: number
  totalExpensesThisMonth: number
  nextPayDayWorker?: { name: string; daysUntilPayDay: number; amount: number } | null
  expensesByCategory: {
    feeds: number
    vitamins: number
    medicines: number
    deworming: number
    workers_extra_budget: number
    miscellaneous: number
  }
}

interface DashboardData {
  breeding: {
    totalSeasons: number
    activeSeason: ActiveSeason | null
    totalMatings: number
  }
  finance: FinanceData | null
}

// ─── tips rotation ────────────────────────────────────────────────────────────

const TIPS = [
  { icon: '💧', title: 'Hydration First', body: 'Always check waterers before feeding. Dehydrated birds absorb nutrients poorly.' },
  { icon: '🌡️', title: 'Brooder Temperature', body: 'Keep day-old chicks at 35°C. Reduce by 3°C each week until fully feathered.' },
  { icon: '🥚', title: 'Egg Turning', body: 'Turn eggs at least 3x daily for the first 18 days. Stop turning on day 19.' },
  { icon: '💊', title: 'Deworming Schedule', body: 'Deworm every 3 months. Best done in the morning on an empty stomach.' },
  { icon: '🌿', title: 'Feed Rotation', body: 'Rotate feed brands every season to avoid nutritional gaps and build resilience.' },
  { icon: '⚡', title: 'Conditioning Tip', body: 'Start road work 8 weeks before derby day. Consistency beats intensity.' },
  { icon: '🔍', title: 'Health Check', body: 'Check droppings daily. Green or yellow loose droppings are early warning signs.' },
  { icon: '🐣', title: 'Chick Survival', body: 'First 72 hours are critical. Keep chicks warm, dry, and away from drafts.' },
  { icon: '🧪', title: 'Vitamin Timing', body: 'Give vitamins in drinking water, not mixed with feed. Avoid overdosing B-complex.' },
  { icon: '📅', title: 'Season Planning', body: 'Plan your breeding season 3 months ahead. Match hatch dates to your target derby.' },
]

const todayTip = TIPS[new Date().getDate() % TIPS.length]

// ─── jumbotron cards ──────────────────────────────────────────────────────────

function SeasonCard({ data, onPress }: { data: DashboardData['breeding']; onPress: () => void }) {
  const { activeSeason, totalSeasons, totalMatings } = data

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        width: CARD_W, height: 200,
        backgroundColor: '#141414',
        borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A',
        padding: 20, justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      {/* Background accent */}
      <View style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: '#C8A84B08' }} />
      <View style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: '#C8A84B05' }} />

      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18 }}>🌾</Text>
          <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Breeding Season
          </Text>
        </View>
        <View style={{
          backgroundColor: activeSeason?.markingsGenerated ? '#22C55E22' : '#C8A84B22',
          borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
        }}>
          <Text style={{ color: activeSeason?.markingsGenerated ? '#22C55E' : '#C8A84B', fontSize: 11, fontWeight: '700' }}>
            {activeSeason?.markingsGenerated ? 'Generated' : activeSeason ? 'Active' : 'No Season'}
          </Text>
        </View>
      </View>

      {/* Main content */}
      {activeSeason ? (
        <View>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 4 }}>
            {activeSeason.name} {activeSeason.year}
          </Text>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View>
              <Text style={{ color: '#C8A84B', fontSize: 26, fontWeight: '800' }}>{activeSeason.matingCount}</Text>
              <Text style={{ color: '#606060', fontSize: 11 }}>Matings</Text>
            </View>
            {activeSeason.chicksHatched != null && (
              <View>
                <Text style={{ color: '#C8A84B', fontSize: 26, fontWeight: '800' }}>{activeSeason.chicksHatched}</Text>
                <Text style={{ color: '#606060', fontSize: 11 }}>Chicks</Text>
              </View>
            )}
            {activeSeason.hatchRate != null && (
              <View>
                <Text style={{ color: '#22C55E', fontSize: 26, fontWeight: '800' }}>{activeSeason.hatchRate}%</Text>
                <Text style={{ color: '#606060', fontSize: 11 }}>Hatch Rate</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 4 }}>
            {totalSeasons} Season{totalSeasons !== 1 ? 's' : ''} · {totalMatings} Matings
          </Text>
          <Text style={{ color: '#606060', fontSize: 13 }}>No active season running</Text>
        </View>
      )}

      {/* Footer */}
      <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>Open Breeding →</Text>
    </TouchableOpacity>
  )
}

function PayrollCard({ data, onPress }: { data: FinanceData; onPress: () => void }) {
  const pesoFormat = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const isUrgent = data.unpaidWorkers > 0

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        width: CARD_W, height: 200,
        backgroundColor: '#141414',
        borderRadius: 20, borderWidth: 1,
        borderColor: isUrgent ? '#F59E0B44' : '#2A2A2A',
        padding: 20, justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      {/* Background accent */}
      <View style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: isUrgent ? '#F59E0B08' : '#3B82F608' }} />

      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18 }}>💼</Text>
          <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Farm Finance
          </Text>
        </View>
        {isUrgent && (
          <View style={{ backgroundColor: '#F59E0B22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>{data.unpaidWorkers} Unpaid</Text>
          </View>
        )}
      </View>

      {/* Main content */}
      <View>
        <Text style={{ color: isUrgent ? '#F59E0B' : '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 4 }}>
          {pesoFormat(data.totalSalaryDue)}
        </Text>
        <Text style={{ color: '#606060', fontSize: 13 }}>Total salary due · {data.totalWorkers} worker{data.totalWorkers !== 1 ? 's' : ''}</Text>
        {data.totalExpensesThisMonth > 0 && (
          <Text style={{ color: '#A0A0A0', fontSize: 12, marginTop: 6 }}>
            + {pesoFormat(data.totalExpensesThisMonth)} expenses this month
          </Text>
        )}
      </View>

      {/* Footer */}
      <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>Open Finance →</Text>
    </TouchableOpacity>
  )
}

function HatchCard({ season, onPress }: { season: ActiveSeason; onPress: () => void }) {
  const expectedDate = season.expectedHatchDate ? new Date(season.expectedHatchDate) : null
  const daysLeft = expectedDate
    ? Math.ceil((expectedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  if (!season.eggsLaid || season.eggsLaid === 0) return null

  const isPast = daysLeft !== null && daysLeft <= 0

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        width: CARD_W, height: 200,
        backgroundColor: '#141414',
        borderRadius: 20, borderWidth: 1, borderColor: '#3B82F644',
        padding: 20, justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: '#3B82F608' }} />

      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>🥚</Text>
        <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
          {isPast ? 'Hatch Date' : 'Expected Hatch'}
        </Text>
      </View>

      {/* Main content */}
      <View>
        {daysLeft !== null ? (
          <>
            <Text style={{ color: '#3B82F6', fontSize: 36, fontWeight: '800' }}>
              {isPast ? 'Now!' : `${daysLeft}d`}
            </Text>
            <Text style={{ color: '#606060', fontSize: 13 }}>
              {isPast ? 'Hatch date has passed' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until hatch`}
            </Text>
          </>
        ) : (
          <Text style={{ color: '#3B82F6', fontSize: 22, fontWeight: '800' }}>Eggs Incubating</Text>
        )}
        <Text style={{ color: '#A0A0A0', fontSize: 12, marginTop: 6 }}>
          {season.eggsLaid} eggs · {season.name} {season.year}
        </Text>
      </View>

      {/* Footer */}
      <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>View Season →</Text>
    </TouchableOpacity>
  )
}

// ─── jumbotron carousel ───────────────────────────────────────────────────────

function Jumbotron({ data, onBreeding, onFinance }: {
  data: DashboardData
  onBreeding: () => void
  onFinance: () => void
}) {
  const scrollRef = useRef<ScrollView>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cards: React.ReactNode[] = [
    <SeasonCard key="season" data={data.breeding} onPress={onBreeding} />,
  ]

  if (data.finance && data.finance.totalWorkers > 0) {
    cards.push(<PayrollCard key="payroll" data={data.finance} onPress={onFinance} />)
  }

  if (data.breeding.activeSeason?.eggsLaid) {
    cards.push(
      <HatchCard key="hatch" season={data.breeding.activeSeason} onPress={onBreeding} />
    )
  }

  function scrollTo(index: number) {
    scrollRef.current?.scrollTo({ x: index * (CARD_W + 12), animated: true })
    setActiveIndex(index)
  }

  useEffect(() => {
    if (cards.length <= 1) return
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % cards.length
        scrollRef.current?.scrollTo({ x: next * (CARD_W + 12), animated: true })
        return next
      })
    }, 4000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [cards.length])

  return (
    <View style={{ marginBottom: 24 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_W + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 12))
          setActiveIndex(index)
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = setInterval(() => {
            setActiveIndex((prev) => {
              const next = (prev + 1) % cards.length
              scrollRef.current?.scrollTo({ x: next * (CARD_W + 12), animated: true })
              return next
            })
          }, 4000)
        }}
      >
        {cards}
      </ScrollView>

      {/* Dot indicators */}
      {cards.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {cards.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => scrollTo(i)} activeOpacity={0.7}>
              <View style={{
                width: i === activeIndex ? 20 : 6,
                height: 6, borderRadius: 3,
                backgroundColor: i === activeIndex ? '#C8A84B' : '#2A2A2A',
              }} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── quick actions ────────────────────────────────────────────────────────────

function QuickActions({ onMating, onExpense }: { onMating: () => void; onExpense: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 24 }}>
      <TouchableOpacity
        onPress={onMating}
        activeOpacity={0.8}
        style={{
          flex: 1, backgroundColor: '#C8A84B',
          borderRadius: 14, paddingVertical: 14,
          alignItems: 'center', flexDirection: 'row',
          justifyContent: 'center', gap: 8,
        }}
      >
        <Text style={{ fontSize: 16 }}>🐓</Text>
        <Text style={{ color: '#0A0A0A', fontSize: 13, fontWeight: '800' }}>Breeding Records</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onExpense}
        activeOpacity={0.8}
        style={{
          flex: 1, backgroundColor: '#1E1E1E',
          borderRadius: 14, paddingVertical: 14,
          alignItems: 'center', flexDirection: 'row',
          justifyContent: 'center', gap: 8,
          borderWidth: 1, borderColor: '#2A2A2A',
        }}
      >
        <Text style={{ fontSize: 16 }}>💸</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Log Expense</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── tip of the day ───────────────────────────────────────────────────────────

function TipOfDay() {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
      <Text style={{ color: '#606060', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        Tip of the Day
      </Text>
      <View style={{
        backgroundColor: '#141414', borderRadius: 16,
        borderWidth: 1, borderColor: '#2A2A2A',
        padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start',
      }}>
        <View style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: '#C8A84B15', alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 22 }}>{todayTip.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
            {todayTip.title}
          </Text>
          <Text style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 20 }}>
            {todayTip.body}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <View style={{ paddingTop: 16 }}>
      <View style={{ marginHorizontal: 16, height: 200, borderRadius: 20, backgroundColor: '#141414', marginBottom: 24 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 24 }}>
        <View style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: '#141414' }} />
        <View style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: '#141414' }} />
      </View>
      <View style={{ marginHorizontal: 16, height: 90, borderRadius: 16, backgroundColor: '#141414' }} />
    </View>
  )
}

// ─── main screen ──────────────────────────────────────────────────────────────

// ─── trial banner ─────────────────────────────────────────────────────────────

function TrialBanner({
  status, trialEndsAt, onUpgrade,
}: {
  status: string | null
  trialEndsAt: string | null
  onUpgrade: () => void
}) {
  if (!status || status === 'active') return null

  const daysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  // Only show banner when trial ≤ 14 days remaining, or already expired/suspended
  const isExpired   = status === 'expired'
  const isSuspended = status === 'suspended'
  const isTrialSoon = status === 'trial' && daysLeft !== null && daysLeft <= 14

  if (!isExpired && !isSuspended && !isTrialSoon) return null

  const bgColor   = isExpired || isSuspended ? '#EF444418' : '#F59E0B18'
  const bdColor   = isExpired || isSuspended ? '#EF444444' : '#F59E0B44'
  const textColor = isExpired || isSuspended ? '#EF4444'   : '#F59E0B'

  const message = isSuspended
    ? 'Your account is suspended. Contact support.'
    : isExpired
    ? 'Your free trial has ended. Upgrade to keep using TIKNOK.'
    : daysLeft === 0
    ? 'Your free trial ends today!'
    : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`

  return (
    <TouchableOpacity
      onPress={onUpgrade}
      activeOpacity={0.85}
      style={{
        marginHorizontal: 16, marginBottom: 16,
        backgroundColor: bgColor,
        borderRadius: 12, borderWidth: 1, borderColor: bdColor,
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 10, gap: 10,
      }}
    >
      <Text style={{ fontSize: 16 }}>{isSuspended ? '🔒' : isExpired ? '⚠️' : '⏳'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>{message}</Text>
        {!isSuspended && (
          <Text style={{ color: textColor, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            ₱50/month or ₱499/year · Tap to learn more
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subStatus, setSubStatus]       = useState<string | null>(null)
  const [trialEndsAt, setTrialEndsAt]   = useState<string | null>(null)
  const [hasPassword, setHasPassword]   = useState<boolean>(true)
  const [accountSecuredAt, setAccountSecuredAt] = useState<string | null>(null)
  const [secureSheetVisible, setSecureSheetVisible] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [result, me] = await Promise.all([
        apiRequest<DashboardData>('/dashboard'),
        apiRequest<{ subscriptionStatus?: string; trialEndsAt?: string | null; hasPassword?: boolean; accountSecuredAt?: string | null }>('/auth/me'),
      ])
      setData(result)
      setSubStatus(me.subscriptionStatus ?? null)
      setTrialEndsAt(me.trialEndsAt ?? null)
      setHasPassword(me.hasPassword !== false)
      setAccountSecuredAt(me.accountSecuredAt ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
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

  const goBreeding = () => router.push('/(app)/breeder/marking-generator' as any)
  const goFinance  = () => router.push('/(app)/breeder/finance' as any)

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>

      {/* Header */}
      <View style={{
        paddingTop: 52, paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
      }}>
        <Image
          source={require('../../assets/wordmark.png')}
          style={{ height: 28, width: 120 }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => router.push('/(app)/notifications' as any)} activeOpacity={0.7}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {loading && !data ? (
        <Skeleton />
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A84B" />}
        >
          {data && (
            <>
              {!hasPassword && !accountSecuredAt && (
                <TouchableOpacity
                  onPress={() => setSecureSheetVisible(true)}
                  activeOpacity={0.85}
                  style={{
                    marginHorizontal: 16, marginBottom: 16,
                    backgroundColor: '#3B82F618',
                    borderRadius: 12, borderWidth: 1, borderColor: '#3B82F644',
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🔐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '700' }}>Secure your account</Text>
                    <Text style={{ color: '#3B82F6', fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                      Add a password so you can always log in · Tap to set up
                    </Text>
                  </View>
                  <Text style={{ color: '#3B82F6', fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              )}
              <TrialBanner
                status={subStatus}
                trialEndsAt={trialEndsAt}
                onUpgrade={() => router.push('/(app)/profile/me' as any)}
              />
              <Jumbotron
                data={data}
                onBreeding={goBreeding}
                onFinance={goFinance}
              />
              <QuickActions
                onMating={goBreeding}
                onExpense={goFinance}
              />
              <TipOfDay />
            </>
          )}
        </ScrollView>
      )}

      <SecureAccountSheet
        visible={secureSheetVisible}
        hasPlaceholderEmail={!hasPassword && !accountSecuredAt}
        onClose={() => setSecureSheetVisible(false)}
        onSecured={() => {
          setSecureSheetVisible(false)
          setAccountSecuredAt(new Date().toISOString())
          setHasPassword(true)
        }}
      />
    </View>
  )
}
