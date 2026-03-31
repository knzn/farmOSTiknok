import { useState, useCallback, useRef } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import SimpleBottomSheet, { BottomSheetView, type SimpleBottomSheetRef } from '../../../../../components/SimpleBottomSheet'
import { apiRequest } from '../../../../../lib/api'
import { useToastStore } from '../../../../../stores/toast'

// ─── types ───────────────────────────────────────────────────────────────────

interface WorkerData {
  id: string
  name: string
  position: string
  monthlySalary: number
  salaryDay: number
  photo: string | null
  advances: { amount: number; month: number; year: number }[]
  payments: { month: number; year: number }[]
}

const POSITION_PRESETS = [
  'Farm Manager',
  'Handler',
  'Assistant Handler',
  'Breeder',
  'Assistant Breeder',
  'Farm Buddy',
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function pesoFormat(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currentMonthNetPay(worker: WorkerData): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const advances = worker.advances
    .filter((a) => a.month === month && a.year === year)
    .reduce((s, a) => s + a.amount, 0)
  return Math.max(0, worker.monthlySalary - advances)
}

function isCurrentMonthPaid(worker: WorkerData): boolean {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return worker.payments.some((p) => p.month === month && p.year === year)
}

// ─── component ───────────────────────────────────────────────────────────────

export default function WorkerListScreen() {
  const router = useRouter()
  const sheetRef = useRef<SimpleBottomSheetRef>(null)
  const showToast = useToastStore((s) => s.show)

  const [workers, setWorkers] = useState<WorkerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [customPosition, setCustomPosition] = useState('')
  const [salary, setSalary] = useState('')
  const [salaryDay, setSalaryDay] = useState('30')
  const [creating, setCreating] = useState(false)
  const [showCustom, setShowCustom] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await apiRequest<WorkerData[]>('/workers')
      setWorkers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workers')
    }
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  function resetForm() {
    setName('')
    setPosition('')
    setCustomPosition('')
    setSalary('')
    setSalaryDay('30')
    setShowCustom(false)
  }

  async function handleCreate() {
    const finalPosition = showCustom ? customPosition.trim() : position
    if (!name.trim() || !finalPosition || !salary) return

    const monthlySalary = parseFloat(salary.replace(/,/g, ''))
    if (isNaN(monthlySalary) || monthlySalary < 0) return

    const day = parseInt(salaryDay, 10)
    const finalSalaryDay = isNaN(day) || day < 1 || day > 31 ? 30 : day

    setCreating(true)
    try {
      const worker = await apiRequest<WorkerData>('/workers', {
        method: 'POST',
        body: { name: name.trim(), position: finalPosition, monthlySalary, salaryDay: finalSalaryDay },
      })
      setWorkers((prev) => [worker, ...prev])
      showToast('Worker added')
      sheetRef.current?.close(resetForm)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create worker')
    } finally {
      setCreating(false)
    }
  }

  function openSheet() {
    resetForm()
    sheetRef.current?.expand()
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#0A0A0A',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        paddingTop: 52,
        paddingBottom: 12,
        paddingHorizontal: 16,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }} activeOpacity={0.7}>
          <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>← Farm Finance</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', flex: 1 }}>Workers</Text>
          <TouchableOpacity
            onPress={openSheet}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#C8A84B',
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#0A0A0A', fontSize: 13, fontWeight: '700' }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#C8A84B" />
        </View>
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
      ) : workers.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>👷</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 }}>No workers yet</Text>
          <Text style={{ color: '#606060', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            Add your farm workers to track their salary and advances.
          </Text>
          <TouchableOpacity
            onPress={openSheet}
            activeOpacity={0.8}
            style={{ borderWidth: 1, borderColor: '#C8A84B', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}
          >
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>Add First Worker</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={workers}
          contentContainerStyle={{ padding: 16 }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const paid = isCurrentMonthPaid(item)
            const netPay = currentMonthNetPay(item)
            return (
              <TouchableOpacity
                onPress={() => router.push(`/(app)/breeder/finance/workers/${item.id}` as any)}
                activeOpacity={0.75}
                style={{
                  backgroundColor: '#141414',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#2A2A2A',
                  padding: 14,
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {/* Avatar */}
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#1E1E1E',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Text style={{ fontSize: 20 }}>👷</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: '#A0A0A0', fontSize: 12 }}>{item.position}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700' }}>
                    {pesoFormat(netPay)}
                  </Text>
                  <View style={{
                    marginTop: 4,
                    backgroundColor: paid ? '#22C55E22' : '#C8A84B22',
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}>
                    <Text style={{
                      color: paid ? '#22C55E' : '#C8A84B',
                      fontSize: 10,
                      fontWeight: '700',
                    }}>
                      {paid ? 'PAID' : 'UNPAID'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* Create Worker Sheet */}
      <SimpleBottomSheet
        ref={sheetRef}
        snapPoints={['72%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
      >
        <BottomSheetView>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 220 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 20 }}>
              Add Worker
            </Text>

            {/* Name */}
            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              NAME *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#404040"
              style={{
                backgroundColor: '#1E1E1E',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#2A2A2A',
                color: '#FFFFFF',
                fontSize: 15,
                padding: 12,
                marginBottom: 16,
              }}
            />

            {/* Position presets */}
            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              POSITION *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {POSITION_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => { setPosition(p); setShowCustom(false) }}
                  activeOpacity={0.75}
                  style={{
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: position === p && !showCustom ? '#C8A84B' : '#2A2A2A',
                    backgroundColor: position === p && !showCustom ? '#C8A84B22' : '#1E1E1E',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{
                    color: position === p && !showCustom ? '#C8A84B' : '#A0A0A0',
                    fontSize: 12,
                    fontWeight: '600',
                  }}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => { setShowCustom(true); setPosition('') }}
                activeOpacity={0.75}
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: showCustom ? '#C8A84B' : '#2A2A2A',
                  backgroundColor: showCustom ? '#C8A84B22' : '#1E1E1E',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: showCustom ? '#C8A84B' : '#A0A0A0', fontSize: 12, fontWeight: '600' }}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>
            {showCustom && (
              <TextInput
                value={customPosition}
                onChangeText={setCustomPosition}
                placeholder="Enter custom position"
                placeholderTextColor="#404040"
                autoFocus
                style={{
                  backgroundColor: '#1E1E1E',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#C8A84B',
                  color: '#FFFFFF',
                  fontSize: 15,
                  padding: 12,
                  marginBottom: 4,
                }}
              />
            )}
            <View style={{ marginBottom: 16 }} />

            {/* Monthly Salary */}
            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              MONTHLY SALARY (₱) *
            </Text>
            <TextInput
              value={salary}
              onChangeText={setSalary}
              placeholder="e.g. 10000"
              placeholderTextColor="#404040"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1E1E1E',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#2A2A2A',
                color: '#FFFFFF',
                fontSize: 15,
                padding: 12,
                marginBottom: 16,
              }}
            />

            {/* Salary Day */}
            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
              PAY DAY (day of month) *
            </Text>
            <Text style={{ color: '#606060', fontSize: 11, marginBottom: 6 }}>
              Which day each month is salary due? (e.g. 30 = every 30th)
            </Text>
            <TextInput
              value={salaryDay}
              onChangeText={setSalaryDay}
              placeholder="30"
              placeholderTextColor="#404040"
              keyboardType="numeric"
              maxLength={2}
              style={{
                backgroundColor: '#1E1E1E',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#2A2A2A',
                color: '#FFFFFF',
                fontSize: 15,
                padding: 12,
                marginBottom: 24,
              }}
            />

            {/* Submit */}
            <TouchableOpacity
              onPress={handleCreate}
              activeOpacity={0.8}
              disabled={creating || !name.trim() || !(showCustom ? customPosition.trim() : position) || !salary}
              style={{
                backgroundColor: creating || !name.trim() || !(showCustom ? customPosition.trim() : position) || !salary
                  ? '#2A2A2A'
                  : '#C8A84B',
                borderRadius: 10,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: creating || !name.trim() || !(showCustom ? customPosition.trim() : position) || !salary
                  ? '#606060'
                  : '#0A0A0A',
                fontSize: 15,
                fontWeight: '700',
              }}>
                {creating ? 'Adding...' : 'Add Worker'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheetView>
      </SimpleBottomSheet>
    </View>
  )
}
