import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useCallback, useEffect } from 'react'
import { useFocusEffect } from 'expo-router'
import { apiRequest } from '../../../lib/api'

interface FeedProgram {
  gramsPerFeeding: number
  feedingsPerDay: 1 | 2
  fastingDaysPerWeek: number
  costPerKg: number
  currency: string
}

interface InventoryData {
  total: number
}

const GRAM_PRESETS = [35, 40, 45, 50] as const

export default function FeedCalculatorScreen() {
  const router = useRouter()

  const [gramsPerFeeding, setGramsPerFeeding] = useState(40)
  const [customGrams, setCustomGrams] = useState('')
  const [useCustomGrams, setUseCustomGrams] = useState(false)
  const [feedingsPerDay, setFeedingsPerDay] = useState<1 | 2>(1)
  const [fastingDaysPerWeek, setFastingDaysPerWeek] = useState(0)
  const [costPerKg, setCostPerKg] = useState('')
  const [currency] = useState('PHP')
  const [birdCount, setBirdCount] = useState('')
  const [inventoryTotal, setInventoryTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load existing program + inventory on focus
  useFocusEffect(useCallback(() => {
    async function load() {
      setLoading(true)
      try {
        const [program, inventory] = await Promise.all([
          apiRequest<FeedProgram | null>('/farm/feed-program'),
          apiRequest<InventoryData>('/farm/inventory'),
        ])
        if (program) {
          setGramsPerFeeding(program.gramsPerFeeding)
          setFeedingsPerDay(program.feedingsPerDay)
          setFastingDaysPerWeek(program.fastingDaysPerWeek ?? 0)
          setCostPerKg(String(program.costPerKg))
          if (!GRAM_PRESETS.includes(program.gramsPerFeeding as any)) {
            setUseCustomGrams(true)
            setCustomGrams(String(program.gramsPerFeeding))
          }
        }
        setInventoryTotal(inventory?.total ?? 0)
        if (!birdCount && inventory?.total) {
          setBirdCount(String(inventory.total))
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, []))

  // Live calculation
  const effectiveGrams = useCustomGrams ? (parseInt(customGrams) || 0) : gramsPerFeeding
  const birds = parseInt(birdCount) || 0
  const dailyGrams = birds * effectiveGrams * feedingsPerDay
  const dailyKg = dailyGrams / 1000
  const weeklyKg = dailyKg * (7 - fastingDaysPerWeek)
  const monthlyKg = weeklyKg * 4.33
  const costNum = parseFloat(costPerKg) || 0
  const monthlyCost = monthlyKg * costNum

  const fmt = (n: number) => n.toFixed(2)

  async function handleSave() {
    if (!effectiveGrams || !costNum) {
      Alert.alert('Missing fields', 'Please enter grams per feeding and cost per kg.')
      return
    }
    setSaving(true)
    try {
      await apiRequest('/farm/feed-program', {
        method: 'PUT',
        body: {
          gramsPerFeeding: effectiveGrams,
          feedingsPerDay,
          fastingDaysPerWeek,
          costPerKg: costNum,
          currency,
        },
      })
      router.back()
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0A0A0A' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
      }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 16 }}>
          <Text style={{ color: '#C8A84B', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', flex: 1 }}>Feed Calculator</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bird count */}
        <Section title="Number of Birds">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TextInput
              value={birdCount}
              onChangeText={v => setBirdCount(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#404040"
              style={inputStyle}
              selectTextOnFocus
            />
            {inventoryTotal > 0 && (
              <TouchableOpacity
                onPress={() => setBirdCount(String(inventoryTotal))}
                activeOpacity={0.8}
                style={{
                  borderWidth: 1, borderColor: '#C8A84B', borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>
                  Use inventory ({inventoryTotal})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Section>

        {/* Grams per feeding */}
        <Section title="Grams per Feeding">
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: useCustomGrams ? 10 : 0 }}>
            {GRAM_PRESETS.map(g => (
              <TouchableOpacity
                key={g}
                onPress={() => { setUseCustomGrams(false); setGramsPerFeeding(g) }}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                  backgroundColor: !useCustomGrams && gramsPerFeeding === g ? '#C8A84B' : '#1E1E1E',
                  borderWidth: 1,
                  borderColor: !useCustomGrams && gramsPerFeeding === g ? '#C8A84B' : '#2A2A2A',
                }}
              >
                <Text style={{
                  color: !useCustomGrams && gramsPerFeeding === g ? '#000000' : '#FFFFFF',
                  fontSize: 13, fontWeight: '600',
                }}>
                  {g}g
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setUseCustomGrams(true)}
              activeOpacity={0.8}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                backgroundColor: useCustomGrams ? '#C8A84B' : '#1E1E1E',
                borderWidth: 1, borderColor: useCustomGrams ? '#C8A84B' : '#2A2A2A',
              }}
            >
              <Text style={{ color: useCustomGrams ? '#000000' : '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>
          {useCustomGrams && (
            <TextInput
              value={customGrams}
              onChangeText={v => setCustomGrams(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Enter grams"
              placeholderTextColor="#404040"
              style={inputStyle}
              selectTextOnFocus
            />
          )}
        </Section>

        {/* Feedings per day */}
        <Section title="Feedings per Day">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([1, 2] as const).map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFeedingsPerDay(f)}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
                  backgroundColor: feedingsPerDay === f ? '#C8A84B' : '#1E1E1E',
                  borderWidth: 1,
                  borderColor: feedingsPerDay === f ? '#C8A84B' : '#2A2A2A',
                }}
              >
                <Text style={{
                  color: feedingsPerDay === f ? '#000000' : '#FFFFFF',
                  fontSize: 15, fontWeight: '700',
                }}>
                  {f}x / day
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Fasting days */}
        <Section title="Fasting Days per Week">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([0, 1, 2] as const).map(d => (
              <TouchableOpacity
                key={d}
                onPress={() => setFastingDaysPerWeek(d)}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
                  backgroundColor: fastingDaysPerWeek === d ? '#C8A84B' : '#1E1E1E',
                  borderWidth: 1,
                  borderColor: fastingDaysPerWeek === d ? '#C8A84B' : '#2A2A2A',
                }}
              >
                <Text style={{
                  color: fastingDaysPerWeek === d ? '#000000' : '#FFFFFF',
                  fontSize: 15, fontWeight: '700',
                }}>
                  {d === 0 ? 'None' : d === 1 ? '1 day' : '2 days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Cost per kg */}
        <Section title={`Feed Cost per kg (${currency})`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#C8A84B', fontSize: 18, fontWeight: '700' }}>₱</Text>
            <TextInput
              value={costPerKg}
              onChangeText={v => setCostPerKg(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#404040"
              style={[inputStyle, { flex: 1 }]}
              selectTextOnFocus
            />
          </View>
        </Section>

        {/* Results */}
        <View style={{
          backgroundColor: '#141414', borderRadius: 12,
          borderWidth: 1, borderColor: '#C8A84B44',
          padding: 16, marginTop: 4,
        }}>
          <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Results
          </Text>
          {[
            { label: 'Daily', value: `${fmt(dailyKg)} kg/day` },
            { label: 'Weekly', value: `${fmt(weeklyKg)} kg/week` },
            { label: 'Monthly', value: `${fmt(monthlyKg)} kg/month` },
          ].map(({ label, value }) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: '#A0A0A0', fontSize: 14 }}>{label}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{value}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#C8A84B', fontSize: 15, fontWeight: '700' }}>Monthly Cost</Text>
            <Text style={{ color: '#C8A84B', fontSize: 18, fontWeight: '800' }}>
              ₱ {monthlyCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 20, paddingBottom: 36,
        backgroundColor: '#0A0A0A',
        borderTopWidth: 1, borderTopColor: '#2A2A2A',
      }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          style={{ backgroundColor: '#C8A84B', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
        >
          {saving
            ? <ActivityIndicator color="#000000" />
            : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>Save Program</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: '#141414', borderRadius: 12,
      borderWidth: 1, borderColor: '#2A2A2A',
      padding: 16, marginBottom: 12,
    }}>
      <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </Text>
      {children}
    </View>
  )
}

const inputStyle = {
  backgroundColor: '#0A0A0A',
  borderWidth: 1,
  borderColor: '#2A2A2A',
  borderRadius: 8,
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '600' as const,
  paddingHorizontal: 14,
  paddingVertical: 12,
}
