import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { apiRequest } from '../../../lib/api'
import SimpleBottomSheet, {
  BottomSheetScrollView,
  type SimpleBottomSheetRef,
} from '../../../components/SimpleBottomSheet'

type Result = 'win' | 'loss' | 'draw' | 'cancelled'

interface FightRecord {
  _id: string
  stagName: string
  bloodline: string | null
  marking: string | null
  result: Result
  weightClass: string | null
  fightDate: string
  notes: string | null
}

interface Summary {
  hasData: boolean
  wins: number
  losses: number
  draws: number
  cancelled: number
  winRate: number
  bestStag: string | null
  bloodlines: { name: string; wins: number; losses: number; winRate: number }[]
}

const BLOODLINES = [
  'Chopsuey', 'Sweater', 'Hatch', 'Roundhead', 'Grey', 'Kelso', 'Lemon',
  'Claret', 'Whitehackle', 'Gull', 'Albany', 'Butcher', 'Radio', 'Asil',
  'SBR', 'Henny', 'White', 'Gold', 'DOM', 'Bulik', 'Lieper',
  'Miner Blue (MUG)', 'Pumpkin', 'Black', 'Blue', 'Mixed', 'NOT in the List',
]

const WEIGHT_CLASSES = ['Bantam', 'Leche', 'Kelite', 'Small', 'Medium', 'Bulto', 'Sable']

const RESULT_CONFIG: Record<Result, { label: string; color: string; bg: string }> = {
  win:       { label: 'Win',       color: '#22C55E', bg: '#22C55E22' },
  loss:      { label: 'Loss',      color: '#EF4444', bg: '#EF444422' },
  draw:      { label: 'Draw',      color: '#F59E0B', bg: '#F59E0B22' },
  cancelled: { label: 'Cancelled', color: '#A0A0A0', bg: '#A0A0A022' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PerformanceScreen() {
  const router = useRouter()
  const sheetRef = useRef<SimpleBottomSheetRef>(null)

  const [tab, setTab] = useState<'records' | 'summary'>('summary')
  const [records, setRecords] = useState<FightRecord[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stagName, setStagName] = useState('')
  const [bloodline, setBloodline] = useState('')
  const [marking, setMarking] = useState('')
  const [result, setResult] = useState<Result>('win')
  const [weightClass, setWeightClass] = useState('')
  const [fightDate, setFightDate] = useState(new Date().toISOString().split('T')[0]!)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [pickerMode, setPickerMode] = useState<'bloodline' | 'weight' | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [rec, sum] = await Promise.all([
        apiRequest<{ records: FightRecord[]; nextCursor: string | null }>('/farm/fights'),
        apiRequest<Summary>('/farm/fights/summary'),
      ])
      setRecords(rec.records)
      setNextCursor(rec.nextCursor)
      setSummary(sum)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [loadData]))

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await apiRequest<{ records: FightRecord[]; nextCursor: string | null }>(
        `/farm/fights?cursor=${nextCursor}`,
      )
      setRecords(prev => [...prev, ...data.records])
      setNextCursor(data.nextCursor)
    } catch {}
    setLoadingMore(false)
  }

  function openAdd() {
    setEditingId(null)
    setStagName('')
    setBloodline('')
    setMarking('')
    setResult('win')
    setWeightClass('')
    setFightDate(new Date().toISOString().split('T')[0]!)
    setNotes('')
    setPickerMode(null)
    sheetRef.current?.expand()
  }

  function openEdit(r: FightRecord) {
    setEditingId(r._id)
    setStagName(r.stagName)
    setBloodline(r.bloodline ?? '')
    setMarking(r.marking ?? '')
    setResult(r.result)
    setWeightClass(r.weightClass ?? '')
    setFightDate(r.fightDate.split('T')[0]!)
    setNotes(r.notes ?? '')
    setPickerMode(null)
    sheetRef.current?.expand()
  }

  async function handleSave() {
    if (!stagName.trim() || !fightDate) {
      Alert.alert('Missing fields', 'Stag name and fight date are required.')
      return
    }
    setSaving(true)
    try {
      const body = {
        stagName: stagName.trim(),
        bloodline: bloodline.trim() || null,
        marking: marking.trim() || null,
        result,
        weightClass: weightClass || null,
        fightDate,
        notes: notes.trim() || null,
      }
      if (editingId) {
        await apiRequest(`/farm/fights/${editingId}`, { method: 'PATCH', body })
      } else {
        await apiRequest('/farm/fights', { method: 'POST', body })
      }
      sheetRef.current?.close()
      await loadData()
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    Alert.alert('Delete Record', `Delete the fight record for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/farm/fights/${id}`, { method: 'DELETE' })
            await loadData()
          } catch (e: any) {
            Alert.alert('Error', e.message)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <View style={{
        paddingTop: 56, paddingBottom: 0, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 16 }}>
            <Text style={{ color: '#C8A84B', fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', flex: 1 }}>Fight Performance</Text>
          <TouchableOpacity
            onPress={openAdd}
            activeOpacity={0.8}
            style={{ backgroundColor: '#C8A84B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: '#000000', fontWeight: '700', fontSize: 14 }}>+ Log</Text>
          </TouchableOpacity>
        </View>
        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: 0 }}>
          {(['summary', 'records'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
              style={{
                flex: 1, paddingVertical: 10, alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: tab === t ? '#C8A84B' : 'transparent',
              }}
            >
              <Text style={{
                color: tab === t ? '#C8A84B' : '#606060',
                fontSize: 14, fontWeight: '600', textTransform: 'capitalize',
              }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#A0A0A0', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); loadData().finally(() => setLoading(false)) }}>
            <Text style={{ color: '#C8A84B', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : tab === 'summary' ? (
        <SummaryTab summary={summary} onLogFight={openAdd} />
      ) : (
        <RecordsTab
          records={records}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          onEdit={openEdit}
          onDelete={handleDelete}
          onAdd={openAdd}
        />
      )}

      {/* Log / Edit sheet */}
      <SimpleBottomSheet
        ref={sheetRef}
        snapPoints={['90%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
              {editingId ? 'Edit Record' : 'Log Fight'}
            </Text>
          </View>
          <BottomSheetScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <FL label="Stag Name *" />
            <TextInput
              value={stagName}
              onChangeText={setStagName}
              placeholder="Name of the stag"
              placeholderTextColor="#404040"
              style={fi}
            />

            <FL label="Result *" />
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              {(Object.keys(RESULT_CONFIG) as Result[]).map(r => {
                const cfg = RESULT_CONFIG[r]
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setResult(r)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                      backgroundColor: result === r ? cfg.bg : '#1E1E1E',
                      borderWidth: 1, borderColor: result === r ? cfg.color : '#2A2A2A',
                    }}
                  >
                    <Text style={{ color: result === r ? cfg.color : '#A0A0A0', fontSize: 12, fontWeight: '700' }}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <FL label="Fight Date *" />
            <TextInput
              value={fightDate}
              onChangeText={setFightDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#404040"
              style={fi}
              keyboardType="numbers-and-punctuation"
            />

            <FL label="Bloodline" />
            <TouchableOpacity
              onPress={() => setPickerMode(pickerMode === 'bloodline' ? null : 'bloodline')}
              activeOpacity={0.8}
              style={[fi, { justifyContent: 'center' }]}
            >
              <Text style={{ color: bloodline ? '#FFFFFF' : '#404040', fontSize: 15 }}>
                {bloodline || 'Select bloodline (optional)'}
              </Text>
            </TouchableOpacity>
            {pickerMode === 'bloodline' && (
              <View style={{ backgroundColor: '#1E1E1E', borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 14, maxHeight: 200 }}>
                <ScrollView>
                  {BLOODLINES.map(b => (
                    <TouchableOpacity
                      key={b}
                      onPress={() => { setBloodline(b); setPickerMode(null) }}
                      style={{ paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: bloodline === b ? '#C8A84B' : '#FFFFFF', fontSize: 14 }}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <FL label="Marking" />
            <TextInput
              value={marking}
              onChangeText={setMarking}
              placeholder="e.g. LN-RF (optional)"
              placeholderTextColor="#404040"
              style={fi}
              autoCapitalize="characters"
            />

            <FL label="Weight Class" />
            <TouchableOpacity
              onPress={() => setPickerMode(pickerMode === 'weight' ? null : 'weight')}
              activeOpacity={0.8}
              style={[fi, { justifyContent: 'center' }]}
            >
              <Text style={{ color: weightClass ? '#FFFFFF' : '#404040', fontSize: 15 }}>
                {weightClass || 'Select weight class (optional)'}
              </Text>
            </TouchableOpacity>
            {pickerMode === 'weight' && (
              <View style={{ backgroundColor: '#1E1E1E', borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 14 }}>
                {WEIGHT_CLASSES.map(w => (
                  <TouchableOpacity
                    key={w}
                    onPress={() => { setWeightClass(w); setPickerMode(null) }}
                    style={{ paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: weightClass === w ? '#C8A84B' : '#FFFFFF', fontSize: 14 }}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <FL label="Notes" />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes about the fight"
              placeholderTextColor="#404040"
              multiline
              maxLength={1000}
              style={[fi, { minHeight: 72, textAlignVertical: 'top' }]}
            />
          </BottomSheetScrollView>
          <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#2A2A2A' }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              style={{ backgroundColor: '#C8A84B', borderRadius: 12, paddingVertical: 15, alignItems: 'center' }}
            >
              {saving
                ? <ActivityIndicator color="#000000" />
                : <Text style={{ color: '#000000', fontWeight: '700', fontSize: 15 }}>
                    {editingId ? 'Save Changes' : 'Log Fight'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SimpleBottomSheet>
    </View>
  )
}

// ─── Summary tab ──────────────────────────────────────────────────────────────

function SummaryTab({ summary, onLogFight }: { summary: Summary | null; onLogFight: () => void }) {
  if (!summary?.hasData) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🏆</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>No fight records yet</Text>
        <Text style={{ color: '#606060', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
          Log your first fight to start tracking win rates and stag performance.
        </Text>
        <TouchableOpacity
          onPress={onLogFight}
          activeOpacity={0.85}
          style={{ backgroundColor: '#C8A84B', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }}
        >
          <Text style={{ color: '#000000', fontWeight: '700', fontSize: 15 }}>Log First Fight</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Win/Loss/Draw row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'Wins', value: summary.wins, color: '#22C55E' },
          { label: 'Losses', value: summary.losses, color: '#EF4444' },
          { label: 'Draws', value: summary.draws, color: '#F59E0B' },
        ].map(({ label, value, color }) => (
          <View key={label} style={{
            flex: 1, backgroundColor: '#141414', borderRadius: 12,
            borderWidth: 1, borderColor: '#2A2A2A', padding: 14, alignItems: 'center',
          }}>
            <Text style={{ color, fontSize: 28, fontWeight: '800' }}>{value}</Text>
            <Text style={{ color: '#A0A0A0', fontSize: 12, marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Win rate + best stag */}
      <View style={{
        backgroundColor: '#141414', borderRadius: 12,
        borderWidth: 1, borderColor: '#C8A84B44',
        padding: 16, marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#A0A0A0', fontSize: 13 }}>Win Rate</Text>
          <Text style={{ color: '#C8A84B', fontSize: 20, fontWeight: '800' }}>{summary.winRate}%</Text>
        </View>
        {summary.bestStag && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#A0A0A0', fontSize: 13 }}>Top Stag</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{summary.bestStag}</Text>
          </View>
        )}
      </View>

      {/* Bloodline breakdown */}
      {summary.bloodlines.length > 0 && (
        <View style={{
          backgroundColor: '#141414', borderRadius: 12,
          borderWidth: 1, borderColor: '#2A2A2A', padding: 16,
        }}>
          <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            By Bloodline
          </Text>
          {summary.bloodlines.map(bl => (
            <View key={bl.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 13, flex: 1 }}>{bl.name}</Text>
              <Text style={{ color: '#22C55E', fontSize: 12, marginRight: 6 }}>{bl.wins}W</Text>
              <Text style={{ color: '#EF4444', fontSize: 12, marginRight: 12 }}>{bl.losses}L</Text>
              <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700', width: 44, textAlign: 'right' }}>
                {bl.winRate}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

// ─── Records tab ──────────────────────────────────────────────────────────────

function RecordsTab({ records, nextCursor, loadingMore, onLoadMore, onEdit, onDelete, onAdd }: {
  records: FightRecord[]
  nextCursor: string | null
  loadingMore: boolean
  onLoadMore: () => void
  onEdit: (r: FightRecord) => void
  onDelete: (id: string, name: string) => void
  onAdd: () => void
}) {
  if (records.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#606060', textAlign: 'center', marginBottom: 16 }}>No fight records yet.</Text>
        <TouchableOpacity onPress={onAdd} activeOpacity={0.85}
          style={{ backgroundColor: '#C8A84B', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ color: '#000000', fontWeight: '700' }}>Log First Fight</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {records.map(r => {
        const cfg = RESULT_CONFIG[r.result]
        return (
          <View key={r._id} style={{
            backgroundColor: '#141414', borderRadius: 12,
            borderWidth: 1, borderColor: '#2A2A2A',
            padding: 14, marginBottom: 10,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                backgroundColor: cfg.bg, borderRadius: 6,
                paddingHorizontal: 10, paddingVertical: 4, marginRight: 10,
              }}>
                <Text style={{ color: cfg.color, fontSize: 12, fontWeight: '700' }}>{cfg.label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{r.stagName}</Text>
                <Text style={{ color: '#606060', fontSize: 11, marginTop: 2 }}>
                  {[r.bloodline, r.weightClass, formatDate(r.fightDate)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            {r.marking && (
              <Text style={{ color: '#A0A0A0', fontSize: 12, marginTop: 6 }}>Marking: {r.marking}</Text>
            )}
            {r.notes && (
              <Text style={{ color: '#606060', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{r.notes}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => onEdit(r)}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center',
                  backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(r._id, r.stagName)}
                activeOpacity={0.8}
                style={{
                  paddingVertical: 7, paddingHorizontal: 16, borderRadius: 7, alignItems: 'center',
                  backgroundColor: '#EF444411', borderWidth: 1, borderColor: '#EF444433',
                }}
              >
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      })}
      {nextCursor && (
        <TouchableOpacity
          onPress={onLoadMore}
          disabled={loadingMore}
          activeOpacity={0.8}
          style={{
            borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10,
            paddingVertical: 12, alignItems: 'center', marginTop: 4,
          }}
        >
          {loadingMore
            ? <ActivityIndicator color="#C8A84B" size="small" />
            : <Text style={{ color: '#A0A0A0', fontSize: 13 }}>Load more</Text>
          }
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

function FL({ label }: { label: string }) {
  return <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
}

const fi: any = {
  backgroundColor: '#0A0A0A',
  borderWidth: 1,
  borderColor: '#2A2A2A',
  borderRadius: 8,
  color: '#FFFFFF',
  fontSize: 15,
  paddingHorizontal: 14,
  paddingVertical: 12,
  marginBottom: 14,
}
