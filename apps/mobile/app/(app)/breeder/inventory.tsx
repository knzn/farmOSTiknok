import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { apiRequest } from '../../../lib/api'

interface InventoryData {
  stags: number
  pullets: number
  broodHens: number
  chicks: number
  cocks: number
  notes: string | null
  total: number
}

const CATEGORIES = [
  { key: 'stags',     label: 'Stags',      desc: 'Adult conditioning males',  emoji: '🐓' },
  { key: 'cocks',     label: 'Cocks',      desc: 'Retired breeding males',    emoji: '🐔' },
  { key: 'pullets',   label: 'Pullets',    desc: 'Young pre-brood females',   emoji: '🐣' },
  { key: 'broodHens', label: 'Brood Hens', desc: 'Active breeding females',   emoji: '🥚' },
  { key: 'chicks',    label: 'Chicks',     desc: 'Unweaned / unsexed chicks', emoji: '🐥' },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

export default function InventoryScreen() {
  const router = useRouter()

  const [counts, setCounts] = useState<Record<CategoryKey, string>>({
    stags: '0', cocks: '0', pullets: '0', broodHens: '0', chicks: '0',
  })
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await apiRequest<InventoryData>('/farm/inventory')
      setCounts({
        stags: String(data.stags),
        cocks: String(data.cocks),
        pullets: String(data.pullets),
        broodHens: String(data.broodHens),
        chicks: String(data.chicks),
      })
      setNotes(data.notes ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory')
    }
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  async function handleSave() {
    setSaving(true)
    try {
      await apiRequest('/farm/inventory', {
        method: 'PUT',
        body: {
          stags: parseInt(counts.stags) || 0,
          cocks: parseInt(counts.cocks) || 0,
          pullets: parseInt(counts.pullets) || 0,
          broodHens: parseInt(counts.broodHens) || 0,
          chicks: parseInt(counts.chicks) || 0,
          notes: notes.trim() || null,
        },
      })
      router.back()
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const total = Object.values(counts).reduce((sum, v) => sum + (parseInt(v) || 0), 0)

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
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Farm Inventory</Text>
          <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>Total: {total} birds</Text>
        </View>
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: '#A0A0A0', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load().finally(() => setLoading(false)) }}>
            <Text style={{ color: '#C8A84B', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {CATEGORIES.map(({ key, label, desc, emoji }) => (
            <View
              key={key}
              style={{
                backgroundColor: '#141414',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#2A2A2A',
                padding: 16,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 28, marginRight: 14 }}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>{label}</Text>
                <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
              <TextInput
                value={counts[key]}
                onChangeText={v => {
                  const n = v.replace(/[^0-9]/g, '')
                  setCounts(prev => ({ ...prev, [key]: n }))
                }}
                keyboardType="number-pad"
                maxLength={5}
                style={{
                  backgroundColor: '#0A0A0A',
                  borderWidth: 1,
                  borderColor: '#2A2A2A',
                  borderRadius: 8,
                  color: '#C8A84B',
                  fontSize: 22,
                  fontWeight: '700',
                  textAlign: 'center',
                  width: 72,
                  height: 48,
                }}
                selectTextOnFocus
              />
            </View>
          ))}

          {/* Notes */}
          <View style={{
            backgroundColor: '#141414', borderRadius: 12,
            borderWidth: 1, borderColor: '#2A2A2A', padding: 16, marginBottom: 12,
          }}>
            <Text style={{ color: '#A0A0A0', fontSize: 13, marginBottom: 8 }}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. 3 stags in conditioning, 2 on rest..."
              placeholderTextColor="#404040"
              multiline
              maxLength={500}
              style={{
                color: '#FFFFFF', fontSize: 14, minHeight: 72,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Total summary */}
          <View style={{
            backgroundColor: '#C8A84B22', borderRadius: 12,
            borderWidth: 1, borderColor: '#C8A84B44',
            padding: 16, flexDirection: 'row', justifyContent: 'space-between',
          }}>
            <Text style={{ color: '#C8A84B', fontSize: 15, fontWeight: '600' }}>Total Birds</Text>
            <Text style={{ color: '#C8A84B', fontSize: 15, fontWeight: '700' }}>{total}</Text>
          </View>
        </ScrollView>
      )}

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
          style={{
            backgroundColor: '#C8A84B', borderRadius: 14,
            paddingVertical: 16, alignItems: 'center',
          }}
        >
          {saving
            ? <ActivityIndicator color="#000000" />
            : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>Save Inventory</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
