import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import SimpleBottomSheet, {
  BottomSheetScrollView,
  type SimpleBottomSheetRef,
} from '../../../components/SimpleBottomSheet'
import { apiRequest } from '../../../lib/api'

type BirdCategory = 'stag' | 'cock' | 'pullet' | 'brood_hen' | 'chick'
type BirdStatus = 'active' | 'retired' | 'sold' | 'deceased'

interface Bird {
  _id: string
  name: string
  bloodline: string | null
  marking: string | null
  category: BirdCategory
  status: BirdStatus
  weight: number | null
  notes: string | null
  createdAt: string
}

const CATEGORIES: { value: BirdCategory; label: string }[] = [
  { value: 'stag', label: 'Stag' },
  { value: 'cock', label: 'Cock' },
  { value: 'pullet', label: 'Pullet' },
  { value: 'brood_hen', label: 'Brood Hen' },
  { value: 'chick', label: 'Chick' },
]

const STATUSES: { value: BirdStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'sold', label: 'Sold' },
  { value: 'deceased', label: 'Deceased' },
]

const STATUS_COLORS: Record<BirdStatus, string> = {
  active: '#22C55E',
  retired: '#F59E0B',
  sold: '#3B82F6',
  deceased: '#EF4444',
}

const CATEGORY_ICONS: Record<BirdCategory, string> = {
  stag: 'S',
  cock: 'C',
  pullet: 'P',
  brood_hen: 'H',
  chick: 'Ch',
}

export default function BirdsScreen() {
  const router = useRouter()
  const sheetRef = useRef<SimpleBottomSheetRef>(null)

  const [birds, setBirds] = useState<Bird[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingBird, setEditingBird] = useState<Bird | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [bloodline, setBloodline] = useState('')
  const [marking, setMarking] = useState('')
  const [category, setCategory] = useState<BirdCategory>('stag')
  const [status, setStatus] = useState<BirdStatus>('active')
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')

  useFocusEffect(useCallback(() => {
    load()
  }, []))

  async function load() {
    setLoading(true)
    try {
      const res = await apiRequest<{ birds: Bird[] }>('/farm/birds')
      setBirds(res.birds)
    } catch {}
    setLoading(false)
  }

  function openAdd() {
    setEditingBird(null)
    setName('')
    setBloodline('')
    setMarking('')
    setCategory('stag')
    setStatus('active')
    setWeight('')
    setNotes('')
    sheetRef.current?.expand()
  }

  function openEdit(bird: Bird) {
    setEditingBird(bird)
    setName(bird.name)
    setBloodline(bird.bloodline ?? '')
    setMarking(bird.marking ?? '')
    setCategory(bird.category)
    setStatus(bird.status)
    setWeight(bird.weight != null ? String(bird.weight) : '')
    setNotes(bird.notes ?? '')
    sheetRef.current?.expand()
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a bird name.')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        bloodline: bloodline.trim() || null,
        marking: marking.trim() || null,
        category,
        status,
        weight: weight ? parseInt(weight) : null,
        notes: notes.trim() || null,
      }
      if (editingBird) {
        const updated = await apiRequest<Bird>(`/farm/birds/${editingBird._id}`, { method: 'PATCH', body })
        setBirds(prev => prev.map(b => b._id === updated._id ? updated : b))
      } else {
        const created = await apiRequest<Bird>('/farm/birds', { method: 'POST', body })
        setBirds(prev => [created, ...prev])
      }
      sheetRef.current?.close()
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bird: Bird) {
    Alert.alert('Remove Bird', `Delete "${bird.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/farm/birds/${bird._id}`, { method: 'DELETE' })
            setBirds(prev => prev.filter(b => b._id !== bird._id))
            sheetRef.current?.close()
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not delete.')
          }
        },
      },
    ])
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
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', flex: 1 }}>Bird Profiles</Text>
        <TouchableOpacity
          onPress={openAdd}
          activeOpacity={0.8}
          style={{ backgroundColor: '#C8A84B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#C8A84B" />
        </View>
      ) : birds.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: '#C8A84B', fontSize: 40, marginBottom: 16 }}>🐓</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>No birds yet</Text>
          <Text style={{ color: '#606060', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            Add individual bird profiles to track bloodlines, markings, and performance.
          </Text>
          <TouchableOpacity
            onPress={openAdd}
            activeOpacity={0.8}
            style={{ backgroundColor: '#C8A84B', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 }}
          >
            <Text style={{ color: '#000000', fontWeight: '700' }}>Add First Bird</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {birds.map(bird => (
            <TouchableOpacity
              key={bird._id}
              onPress={() => openEdit(bird)}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#141414', borderRadius: 12,
                borderWidth: 1, borderColor: '#2A2A2A',
                padding: 16, marginBottom: 10,
                flexDirection: 'row', alignItems: 'center', gap: 14,
              }}
            >
              {/* Category badge */}
              <View style={{
                width: 44, height: 44, borderRadius: 10,
                backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#C8A84B', fontSize: 11, fontWeight: '800' }}>
                  {CATEGORY_ICONS[bird.category]}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{bird.name}</Text>
                <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>
                  {bird.bloodline ?? 'No bloodline'}
                  {bird.marking ? ` · ${bird.marking}` : ''}
                  {bird.weight ? ` · ${bird.weight}g` : ''}
                </Text>
              </View>

              <View style={{
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                backgroundColor: `${STATUS_COLORS[bird.status]}18`,
              }}>
                <Text style={{ color: STATUS_COLORS[bird.status], fontSize: 11, fontWeight: '700' }}>
                  {bird.status.charAt(0).toUpperCase() + bird.status.slice(1)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Add / Edit Bottom Sheet */}
      <SimpleBottomSheet
        ref={sheetRef}
        snapPoints={['90%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#404040' }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 20 }}>
            {editingBird ? 'Edit Bird' : 'Add Bird'}
          </Text>

          <FieldLabel>Name</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Bird name"
            placeholderTextColor="#404040"
            style={inputStyle}
            selectTextOnFocus
          />

          <FieldLabel>Bloodline</FieldLabel>
          <TextInput
            value={bloodline}
            onChangeText={setBloodline}
            placeholder="e.g. Sweater, Kelso"
            placeholderTextColor="#404040"
            style={inputStyle}
            selectTextOnFocus
          />

          <FieldLabel>Marking</FieldLabel>
          <TextInput
            value={marking}
            onChangeText={setMarking}
            placeholder="e.g. LW-RN"
            placeholderTextColor="#404040"
            style={inputStyle}
            selectTextOnFocus
          />

          <FieldLabel>Category</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: category === c.value ? '#C8A84B' : '#1E1E1E',
                  borderWidth: 1, borderColor: category === c.value ? '#C8A84B' : '#2A2A2A',
                }}
              >
                <Text style={{ color: category === c.value ? '#000000' : '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel>Status</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {STATUSES.map(s => (
              <TouchableOpacity
                key={s.value}
                onPress={() => setStatus(s.value)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: status === s.value ? STATUS_COLORS[s.value] + '33' : '#1E1E1E',
                  borderWidth: 1,
                  borderColor: status === s.value ? STATUS_COLORS[s.value] : '#2A2A2A',
                }}
              >
                <Text style={{
                  color: status === s.value ? STATUS_COLORS[s.value] : '#FFFFFF',
                  fontSize: 13, fontWeight: '600',
                }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel>Weight (grams)</FieldLabel>
          <TextInput
            value={weight}
            onChangeText={v => setWeight(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="e.g. 2100"
            placeholderTextColor="#404040"
            style={inputStyle}
            selectTextOnFocus
          />

          <FieldLabel>Notes</FieldLabel>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes..."
            placeholderTextColor="#404040"
            style={[inputStyle, { height: 72, textAlignVertical: 'top' }]}
            multiline
          />

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={{ backgroundColor: '#C8A84B', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
          >
            {saving
              ? <ActivityIndicator color="#000000" />
              : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>{editingBird ? 'Save Changes' : 'Add Bird'}</Text>
            }
          </TouchableOpacity>

          {editingBird && (
            <TouchableOpacity
              onPress={() => handleDelete(editingBird)}
              activeOpacity={0.8}
              style={{
                borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)',
              }}
            >
              <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600' }}>Delete Bird</Text>
            </TouchableOpacity>
          )}
        </BottomSheetScrollView>
      </SimpleBottomSheet>
    </KeyboardAvoidingView>
  )
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
      {children}
    </Text>
  )
}

const inputStyle = {
  backgroundColor: '#0A0A0A',
  borderWidth: 1,
  borderColor: '#2A2A2A',
  borderRadius: 8,
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: '600' as const,
  paddingHorizontal: 14,
  paddingVertical: 12,
  marginBottom: 16,
}
