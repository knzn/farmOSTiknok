import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { MarkingPicker } from '../../../../../../components/MarkingPicker'
import { apiRequest } from '../../../../../../lib/api'
import { useToastStore } from '../../../../../../stores/toast'

type Mating = {
  _id: string
  maleName: string
  sameMarking: boolean | null
  mandatoryMarking: string | null
  hens: { _id: string; henName: string }[]
}

export default function EditMatingScreen() {
  const { seasonId, matingId } = useLocalSearchParams<{ seasonId: string; matingId: string }>()
  const router = useRouter()
  const showToast = useToastStore((s) => s.show)

  const [maleName, setMaleName] = useState('')
  const [henNames, setHenNames] = useState<string[]>([])
  const [sameMarking, setSameMarking] = useState<boolean | null>(null)
  const [mandatoryMarking, setMandatoryMarking] = useState<string | null>(null)
  const [showMarkingPicker, setShowMarkingPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<Mating>(`/seasons/${seasonId}/matings/${matingId}`)
      .then((m) => {
        setMaleName(m.maleName)
        setHenNames(m.hens.map((h) => h.henName))
        setSameMarking(m.sameMarking)
        setMandatoryMarking(m.mandatoryMarking)
      })
      .catch(() => setError('Failed to load mating'))
      .finally(() => setLoading(false))
  }, [seasonId, matingId])

  function setCount(n: number) {
    if (n < 1) return
    setHenNames((prev) => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
    if (n === 1) setSameMarking(null)
  }

  function setHenName(idx: number, value: string) {
    setHenNames((prev) => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }

  async function handleSave() {
    setError(null)
    if (!maleName.trim()) return setError('Male name is required')
    if (henNames.some((n) => !n.trim())) return setError('All hen names are required')

    setSaving(true)
    try {
      await apiRequest(`/seasons/${seasonId}/matings/${matingId}`, {
        method: 'PATCH',
        body: {
          maleName: maleName.trim(),
          henNames: henNames.map((n) => n.trim()),
          sameMarking: henNames.length === 1 ? null : sameMarking,
          mandatoryMarking: mandatoryMarking ?? null,
        },
      })
      showToast('Mating updated')
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color="#FF3D5A" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6 pt-14"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} className="mb-5">
          <Text className="text-accent text-base">‹ Back</Text>
        </TouchableOpacity>

        <Text className="text-ink text-2xl font-bold mb-6">Edit Mating</Text>

        {/* Male name */}
        <View className="mb-5">
          <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
            Male Name
          </Text>
          <TextInput
            className="bg-card text-ink text-base rounded-xl px-4 py-3.5 border border-rim"
            placeholder="e.g. Raptor Sweater / Band #12 / Grey Kelso"
            placeholderTextColor="#A1A1AA"
            value={maleName}
            onChangeText={setMaleName}
            returnKeyType="next"
          />
        </View>

        {/* Hen count stepper */}
        <View className="mb-5">
          <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
            Number of Hens
          </Text>
          <View className="flex-row items-center bg-card rounded-xl border border-rim self-start">
            <TouchableOpacity
              className="w-12 h-12 items-center justify-center"
              onPress={() => setCount(henNames.length - 1)}
              disabled={henNames.length <= 1}
            >
              <Text style={{ fontSize: 24, fontWeight: '300', color: henNames.length <= 1 ? '#2A2A2A' : '#FFFFFF' }}>−</Text>
            </TouchableOpacity>
            <Text className="text-ink text-lg font-bold w-10 text-center">{henNames.length}</Text>
            <TouchableOpacity
              className="w-12 h-12 items-center justify-center"
              onPress={() => setCount(henNames.length + 1)}
            >
              <Text className="text-accent text-2xl font-light">+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hen names */}
        {henNames.length > 0 && (
          <View className="mb-5">
            <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
              Hen Names
            </Text>
            <View className="gap-2">
              {henNames.map((name, idx) => (
                <TextInput
                  key={idx}
                  className="bg-card text-ink text-base rounded-xl px-4 py-3.5 border border-rim"
                  placeholder={`Hen ${idx + 1} — name, band no., or marking`}
                  placeholderTextColor="#A1A1AA"
                  value={name}
                  onChangeText={(v) => setHenName(idx, v)}
                  returnKeyType="next"
                />
              ))}
            </View>
          </View>
        )}

        {/* Same marking — only if 2+ hens */}
        {henNames.length >= 2 && (
          <View className="mb-5">
            <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
              Same Marking for All Hens?
            </Text>
            <View className="flex-row gap-3">
              {[
                { label: 'Yes — Same', value: true },
                { label: 'No — Different', value: false },
              ].map(({ label, value }) => (
                <TouchableOpacity
                  key={String(value)}
                  className={`flex-1 py-3 rounded-xl border items-center ${
                    sameMarking === value ? 'bg-accent-muted border-accent' : 'bg-card border-rim'
                  }`}
                  onPress={() => setSameMarking(value)}
                >
                  <Text className={`text-sm font-semibold ${sameMarking === value ? 'text-accent' : 'text-ink-2'}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Force Marking */}
        <View className="mb-6">
          <TouchableOpacity
            className="flex-row items-center justify-between mb-3"
            onPress={() => setShowMarkingPicker((v) => !v)}
          >
            <View>
              <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider">
                Force Marking (Optional)
              </Text>
              <Text className="text-ink-3 text-xs mt-1">Set a preferred combo for this male. TIKNOK assigns around it.</Text>
            </View>
            <Text className="text-accent text-sm">{showMarkingPicker ? 'Hide ▲' : 'Show ▼'}</Text>
          </TouchableOpacity>

          {mandatoryMarking && !showMarkingPicker && (
            <View className="bg-secondary-muted rounded-xl px-4 py-3 border border-secondary/30">
              <Text className="text-ink-2 text-xs mb-1">Assigned marking</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-secondary text-xl font-bold">{mandatoryMarking}</Text>
                <TouchableOpacity onPress={() => setMandatoryMarking(null)}>
                  <Text className="text-ink-2 text-sm">Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showMarkingPicker && (
            <View className="bg-card rounded-xl p-4 border border-rim">
              <MarkingPicker
                value={mandatoryMarking}
                onChange={(m) => setMandatoryMarking(m)}
              />
            </View>
          )}
        </View>

        {error ? (
          <View className="bg-accent-muted rounded-xl px-4 py-3 mb-4 border border-accent/30">
            <Text className="text-accent text-sm">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className="bg-accent rounded-xl py-4 items-center"
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
