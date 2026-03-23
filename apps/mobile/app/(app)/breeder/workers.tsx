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

interface Worker {
  _id: string
  name: string
  role: string | null
  payType: 'daily' | 'monthly'
  payAmount: number
  currency: string
  isActive: boolean
  notes: string | null
}

interface WorkersResponse {
  workers: Worker[]
  monthlyTotal: number
  currency: string
}

const ROLES = ['Caretaker', 'Feeder', 'Driver', 'Security', 'Trainer', 'Janitor', 'Other']

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function monthlyOf(w: Worker) {
  return w.payType === 'daily' ? w.payAmount * 26 : w.payAmount
}

export default function WorkersScreen() {
  const router = useRouter()
  const sheetRef = useRef<SimpleBottomSheetRef>(null)

  const [workers, setWorkers] = useState<Worker[]>([])
  const [monthlyTotal, setMonthlyTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [payType, setPayType] = useState<'daily' | 'monthly'>('daily')
  const [payAmount, setPayAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [rolePickerOpen, setRolePickerOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await apiRequest<WorkersResponse>('/farm/workers')
      setWorkers(data.workers)
      setMonthlyTotal(data.monthlyTotal)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workers')
    }
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  function openAdd() {
    setEditingId(null)
    setName('')
    setRole('')
    setPayType('daily')
    setPayAmount('')
    setNotes('')
    sheetRef.current?.expand()
  }

  function openEdit(w: Worker) {
    setEditingId(w._id)
    setName(w.name)
    setRole(w.role ?? '')
    setPayType(w.payType)
    setPayAmount(String(w.payAmount))
    setNotes(w.notes ?? '')
    sheetRef.current?.expand()
  }

  async function handleSave() {
    if (!name.trim() || !payAmount) {
      Alert.alert('Missing fields', 'Name and pay amount are required.')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        role: role.trim() || null,
        payType,
        payAmount: parseFloat(payAmount) || 0,
        notes: notes.trim() || null,
      }
      if (editingId) {
        await apiRequest(`/farm/workers/${editingId}`, { method: 'PATCH', body })
      } else {
        await apiRequest('/farm/workers', { method: 'POST', body })
      }
      sheetRef.current?.close()
      await load()
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(w: Worker) {
    Alert.alert(
      'Remove Worker',
      `Remove ${w.name} from your worker list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/farm/workers/${w._id}`, { method: 'DELETE' })
              await load()
            } catch (e: any) {
              Alert.alert('Error', e.message)
            }
          },
        },
      ],
    )
  }

  async function handleToggleActive(w: Worker) {
    try {
      await apiRequest(`/farm/workers/${w._id}`, { method: 'PATCH', body: { isActive: !w.isActive } })
      await load()
    } catch {}
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  const active = workers.filter(w => w.isActive)
  const inactive = workers.filter(w => !w.isActive)

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
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
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Workers</Text>
          {active.length > 0 && (
            <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>
              {active.length} active · ₱{fmt(monthlyTotal)}/mo
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={openAdd}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#C8A84B', borderRadius: 8,
            paddingHorizontal: 14, paddingVertical: 8,
          }}
        >
          <Text style={{ color: '#000000', fontWeight: '700', fontSize: 14 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: '#A0A0A0', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load().finally(() => setLoading(false)) }}>
            <Text style={{ color: '#C8A84B', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : workers.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>👷</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>No workers yet</Text>
          <Text style={{ color: '#606060', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
            Add your farm workers to track headcount and monthly payroll.
          </Text>
          <TouchableOpacity
            onPress={openAdd}
            activeOpacity={0.85}
            style={{ backgroundColor: '#C8A84B', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }}
          >
            <Text style={{ color: '#000000', fontWeight: '700', fontSize: 15 }}>Add First Worker</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Monthly total banner */}
          <View style={{
            backgroundColor: '#C8A84B22', borderRadius: 12,
            borderWidth: 1, borderColor: '#C8A84B44',
            padding: 16, flexDirection: 'row',
            justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 16,
          }}>
            <View>
              <Text style={{ color: '#A0A0A0', fontSize: 12 }}>Monthly Payroll</Text>
              <Text style={{ color: '#C8A84B', fontSize: 22, fontWeight: '800' }}>₱{fmt(monthlyTotal)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#A0A0A0', fontSize: 12 }}>{active.length} active worker{active.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Active workers */}
          {active.map(w => (
            <WorkerCard key={w._id} worker={w} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggleActive} />
          ))}

          {/* Inactive workers */}
          {inactive.length > 0 && (
            <>
              <Text style={{ color: '#606060', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 8 }}>
                Inactive
              </Text>
              {inactive.map(w => (
                <WorkerCard key={w._id} worker={w} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggleActive} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Add/Edit sheet */}
      <SimpleBottomSheet
        ref={sheetRef}
        snapPoints={['72%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
              {editingId ? 'Edit Worker' : 'Add Worker'}
            </Text>
          </View>
          <BottomSheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            <FieldLabel label="Name *" />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Worker name"
              placeholderTextColor="#404040"
              style={fieldInput}
            />

            <FieldLabel label="Role" />
            <TouchableOpacity
              onPress={() => setRolePickerOpen(!rolePickerOpen)}
              activeOpacity={0.8}
              style={[fieldInput, { justifyContent: 'center' }]}
            >
              <Text style={{ color: role ? '#FFFFFF' : '#404040', fontSize: 15 }}>
                {role || 'Select role (optional)'}
              </Text>
            </TouchableOpacity>
            {rolePickerOpen && (
              <View style={{ backgroundColor: '#1E1E1E', borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 12 }}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => { setRole(r); setRolePickerOpen(false) }}
                    style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: role === r ? '#C8A84B' : '#FFFFFF', fontSize: 14 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <FieldLabel label="Pay Type *" />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['daily', 'monthly'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setPayType(t)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
                    backgroundColor: payType === t ? '#C8A84B' : '#1E1E1E',
                    borderWidth: 1, borderColor: payType === t ? '#C8A84B' : '#2A2A2A',
                  }}
                >
                  <Text style={{ color: payType === t ? '#000000' : '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                    {t === 'daily' ? 'Daily Rate' : 'Monthly Salary'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldLabel label={`Amount (₱) — ${payType === 'daily' ? '× 26 working days' : 'fixed monthly'}`} />
            <TextInput
              value={payAmount}
              onChangeText={v => setPayAmount(v.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor="#404040"
              keyboardType="decimal-pad"
              style={fieldInput}
              selectTextOnFocus
            />

            <FieldLabel label="Notes" />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              placeholderTextColor="#404040"
              multiline
              maxLength={500}
              style={[fieldInput, { minHeight: 60, textAlignVertical: 'top' }]}
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
                    {editingId ? 'Save Changes' : 'Add Worker'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SimpleBottomSheet>
    </View>
  )
}

function WorkerCard({ worker: w, onEdit, onDelete, onToggle }: {
  worker: Worker
  onEdit: (w: Worker) => void
  onDelete: (w: Worker) => void
  onToggle: (w: Worker) => void
}) {
  return (
    <View style={{
      backgroundColor: '#141414', borderRadius: 12,
      borderWidth: 1, borderColor: '#2A2A2A',
      padding: 14, marginBottom: 10,
      opacity: w.isActive ? 1 : 0.55,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{w.name}</Text>
          {w.role ? <Text style={{ color: '#A0A0A0', fontSize: 12, marginTop: 2 }}>{w.role}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: '#C8A84B', fontSize: 15, fontWeight: '700' }}>
            ₱{fmt(monthlyOf(w))}/mo
          </Text>
          <Text style={{ color: '#606060', fontSize: 11, marginTop: 2 }}>
            {w.payType === 'daily' ? `₱${fmt(w.payAmount)}/day` : 'monthly salary'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => onToggle(w)}
          activeOpacity={0.8}
          style={{
            flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center',
            backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A',
          }}
        >
          <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600' }}>
            {w.isActive ? 'Deactivate' : 'Reactivate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onEdit(w)}
          activeOpacity={0.8}
          style={{
            flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center',
            backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(w)}
          activeOpacity={0.8}
          style={{
            paddingVertical: 7, paddingHorizontal: 14, borderRadius: 7, alignItems: 'center',
            backgroundColor: '#EF444411', borderWidth: 1, borderColor: '#EF444433',
          }}
        >
          <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={{ color: '#A0A0A0', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>{label}</Text>
}

const fieldInput: any = {
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
