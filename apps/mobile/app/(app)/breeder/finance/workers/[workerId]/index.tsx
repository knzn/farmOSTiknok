import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Image, Modal,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { captureRef } from 'react-native-view-shot'
import * as MediaLibrary from 'expo-media-library'
import * as SecureStore from 'expo-secure-store'
import SimpleBottomSheet, { BottomSheetView, BottomSheetScrollView, type SimpleBottomSheetRef } from '../../../../../../components/SimpleBottomSheet'
import WorkerPayslipCard from '../../../../../../components/WorkerPayslipCard'
import { apiRequest, apiUpload } from '../../../../../../lib/api'
import { useToastStore } from '../../../../../../stores/toast'

// ─── types ───────────────────────────────────────────────────────────────────

interface Advance {
  id: string
  amount: number
  reason: string | null
  date: string
  month: number
  year: number
}

interface Payment {
  id: string
  month: number
  year: number
  grossSalary: number
  totalAdvances: number
  netPay: number
  paidAt: string
}

interface Worker {
  id: string
  name: string
  position: string
  monthlySalary: number
  salaryDay: number
  photo: string | null
  address: string | null
  phoneNumber: string | null
  fbLink: string | null
  advances: Advance[]
  payments: Payment[]
}

const POSITION_PRESETS = [
  'Farm Manager', 'Handler', 'Assistant Handler',
  'Breeder', 'Assistant Breeder', 'Farm Buddy',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0]
}

function pesoFormat(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/** Get start/end dates for a salary period ending on (endMonth, endYear, salaryDay) */
function getPeriodDates(endMonth: number, endYear: number, salaryDay: number) {
  const startMonth = endMonth === 1 ? 12 : endMonth - 1
  const startYear = endMonth === 1 ? endYear - 1 : endYear
  const daysInEnd = new Date(endYear, endMonth, 0).getDate()
  const actualEnd = Math.min(salaryDay, daysInEnd)
  const startDate = new Date(startYear, startMonth - 1, salaryDay + 1, 0, 0, 0)
  const endDate = new Date(endYear, endMonth - 1, actualEnd, 23, 59, 59)
  return { startDate, endDate, startMonth, startYear }
}

/** Which period end (month, year) does today fall in, given the worker's salaryDay? */
function getCurrentPeriodEnd(salaryDay: number, today: Date) {
  const day = today.getDate()
  const month = today.getMonth() + 1
  const year = today.getFullYear()
  if (day <= salaryDay) return { endMonth: month, endYear: year }
  return { endMonth: month === 12 ? 1 : month + 1, endYear: month === 12 ? year + 1 : year }
}

function advancesForPeriod(worker: Worker, endMonth: number, endYear: number) {
  const { startDate, endDate } = getPeriodDates(endMonth, endYear, worker.salaryDay ?? 30)
  return worker.advances.filter((a) => {
    const d = new Date(a.date)
    return d >= startDate && d <= endDate
  })
}

function isMonthPaid(worker: Worker, month: number, year: number) {
  return worker.payments.some((p) => p.month === month && p.year === year)
}

function paymentForMonth(worker: Worker, month: number, year: number) {
  return worker.payments.find((p) => p.month === month && p.year === year) ?? null
}

function periodLabel(endMonth: number, endYear: number, salaryDay: number) {
  const { startDate, endDate } = getPeriodDates(endMonth, endYear, salaryDay)
  const fmt = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  const endFmt = endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(startDate)} – ${endFmt}`
}

// ─── component ───────────────────────────────────────────────────────────────

export default function WorkerDetailScreen() {
  const router = useRouter()
  const { workerId } = useLocalSearchParams<{ workerId: string }>()
  const showToast = useToastStore((s) => s.show)

  const now = new Date()
  const [viewEndMonth, setViewEndMonth] = useState(now.getMonth() + 1)
  const [viewEndYear, setViewEndYear] = useState(now.getFullYear())

  const [worker, setWorker] = useState<Worker | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoModalUri, setPhotoModalUri] = useState<string | null>(null)

  // Payslip export
  const payslipCardRef = useRef<View>(null)
  const exportSheetRef = useRef<SimpleBottomSheetRef>(null)
  const [farmName, setFarmName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [exportingPayslip, setExportingPayslip] = useState(false)

  useEffect(() => {
    SecureStore.getItemAsync('tiknok_farm_name').then((v) => v && setFarmName(v))
    SecureStore.getItemAsync('tiknok_owner_name').then((v) => v && setOwnerName(v))
  }, [])

  // Add advance sheet
  const advanceSheetRef = useRef<SimpleBottomSheetRef>(null)
  const [advAmount, setAdvAmount] = useState('')
  const [advReason, setAdvReason] = useState('')
  const [advDate, setAdvDate] = useState(() => now.toISOString().split('T')[0])
  const [addingAdvance, setAddingAdvance] = useState(false)

  // Edit sheet
  const editSheetRef = useRef<SimpleBottomSheetRef>(null)
  const [editName, setEditName] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [editCustomPosition, setEditCustomPosition] = useState('')
  const [editShowCustom, setEditShowCustom] = useState(false)
  const [editSalary, setEditSalary] = useState('')
  const [editSalaryDay, setEditSalaryDay] = useState('30')
  const [editAddress, setEditAddress] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editFb, setEditFb] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await apiRequest<Worker>(`/workers/${workerId}`)
      setWorker(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load worker')
    }
  }, [workerId])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  // When worker loads, snap view to the correct current salary period
  useEffect(() => {
    if (!worker) return
    const { endMonth, endYear } = getCurrentPeriodEnd(worker.salaryDay ?? 30, now)
    setViewEndMonth(endMonth)
    setViewEndYear(endYear)
  }, [worker?.id])

  // ── photo ─────────────────────────────────────────────────────────────────

  async function handlePhotoTap() {
    if (!worker) return
    if (worker.photo) {
      Alert.alert(worker.name, 'Worker photo', [
        { text: 'View', onPress: () => setPhotoModalUri(worker.photo) },
        { text: 'Change', onPress: pickPhoto },
        { text: 'Remove', style: 'destructive', onPress: removePhoto },
        { text: 'Cancel', style: 'cancel' },
      ])
    } else {
      pickPhoto()
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    setUploadingPhoto(true)
    try {
      const data = await apiUpload<{ photo: string }>(`/workers/${workerId}/photo`, result.assets[0].uri)
      setWorker((prev) => prev ? { ...prev, photo: data.photo } : prev)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function removePhoto() {
    try {
      await apiRequest(`/workers/${workerId}/photo`, { method: 'DELETE' })
      setWorker((prev) => prev ? { ...prev, photo: null } : prev)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to remove photo')
    }
  }

  // ── advance ───────────────────────────────────────────────────────────────

  function openAdvanceSheet() {
    setAdvAmount('')
    setAdvReason('')
    setAdvDate(now.toISOString().split('T')[0])
    advanceSheetRef.current?.expand()
  }

  async function handleAddAdvance() {
    if (!advAmount) return
    const amount = parseFloat(advAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) return
    setAddingAdvance(true)
    try {
      const data = await apiRequest<Worker>(`/workers/${workerId}/advances`, {
        method: 'POST',
        body: { amount, reason: advReason.trim() || null, date: advDate },
      })
      setWorker(data)
      showToast('Advance recorded')
      advanceSheetRef.current?.close()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add advance')
    } finally {
      setAddingAdvance(false)
    }
  }

  async function handleDeleteAdvance(advance: Advance) {
    Alert.alert(
      'Delete Advance',
      `Remove ${pesoFormat(advance.amount)} advance on ${formatDate(advance.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/workers/${workerId}/advances/${advance.id}`, { method: 'DELETE' })
              setWorker((prev) => prev
                ? { ...prev, advances: prev.advances.filter((a) => a.id !== advance.id) }
                : prev)
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete advance')
            }
          },
        },
      ],
    )
  }

  // ── mark paid ─────────────────────────────────────────────────────────────

  async function handleMarkPaid() {
    if (!worker) return
    const netPay = Math.max(0, worker.monthlySalary - monthAdvances.reduce((s, a) => s + a.amount, 0))
    Alert.alert(
      'Mark as Paid',
      `Confirm payment of ${pesoFormat(netPay)} for period ${periodLabel(viewEndMonth, viewEndYear, salaryDay)}?\n\nAdvances for this period will be locked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              const data = await apiRequest<Worker>(`/workers/${workerId}/pay`, {
                method: 'POST',
                body: { month: viewEndMonth, year: viewEndYear },
              })
              setWorker(data)
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to mark as paid')
            }
          },
        },
      ],
    )
  }

  // ── edit ──────────────────────────────────────────────────────────────────

  function openEditSheet() {
    if (!worker) return
    const isCustom = !POSITION_PRESETS.includes(worker.position)
    setEditName(worker.name)
    setEditPosition(isCustom ? '' : worker.position)
    setEditCustomPosition(isCustom ? worker.position : '')
    setEditShowCustom(isCustom)
    setEditSalary(String(worker.monthlySalary))
    setEditSalaryDay(String(worker.salaryDay ?? 30))
    setEditAddress(worker.address ?? '')
    setEditPhone(worker.phoneNumber ?? '')
    setEditFb(worker.fbLink ?? '')
    editSheetRef.current?.expand()
  }

  async function handleSaveEdit() {
    if (!worker) return
    const finalPosition = editShowCustom ? editCustomPosition.trim() : editPosition
    if (!editName.trim() || !finalPosition) return
    const monthlySalary = parseFloat(editSalary.replace(/,/g, ''))
    if (isNaN(monthlySalary) || monthlySalary < 0) return

    setSaving(true)
    try {
      const data = await apiRequest<Worker>(`/workers/${workerId}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          position: finalPosition,
          monthlySalary,
          salaryDay: (() => { const d = parseInt(editSalaryDay, 10); return isNaN(d) || d < 1 || d > 31 ? 30 : d })(),
          address: editAddress.trim() || null,
          phoneNumber: editPhone.trim() || null,
          fbLink: editFb.trim() || null,
        },
      })
      setWorker(data)
      showToast('Changes saved')
      editSheetRef.current?.close()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────

  function handleDelete() {
    Alert.alert(
      'Delete Worker',
      `Remove ${worker?.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/workers/${workerId}`, { method: 'DELETE' })
              router.back()
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete worker')
            }
          },
        },
      ],
    )
  }

  // ── payslip export ────────────────────────────────────────────────────────

  function handleOpenExportSheet() {
    exportSheetRef.current?.expand()
  }

  async function handleConfirmExport() {
    await SecureStore.setItemAsync('tiknok_farm_name', farmName)
    await SecureStore.setItemAsync('tiknok_owner_name', ownerName)
    exportSheetRef.current?.close()
    setExportingPayslip(true)
    try {
      await new Promise((r) => setTimeout(r, 350))
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photo library to save the payslip.')
        return
      }
      const uri = await captureRef(payslipCardRef, { format: 'png', quality: 1 })
      await MediaLibrary.saveToLibraryAsync(uri)
      Alert.alert('Saved!', 'Payslip saved to your Photos.')
    } catch {
      Alert.alert('Error', 'Could not save payslip. Try again.')
    } finally {
      setExportingPayslip(false)
    }
  }

  // ── period nav ────────────────────────────────────────────────────────────

  function prevPeriod() {
    if (viewEndMonth === 1) { setViewEndMonth(12); setViewEndYear((y) => y - 1) }
    else setViewEndMonth((m) => m - 1)
  }

  function nextPeriod() {
    if (!worker) return
    const { endMonth: curEndMonth, endYear: curEndYear } = getCurrentPeriodEnd(worker.salaryDay ?? 30, now)
    if (viewEndYear > curEndYear || (viewEndYear === curEndYear && viewEndMonth >= curEndMonth)) return
    if (viewEndMonth === 12) { setViewEndMonth(1); setViewEndYear((y) => y + 1) }
    else setViewEndMonth((m) => m + 1)
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  if (error || !worker) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#A0A0A0', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error ?? 'Worker not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={{ color: '#C8A84B', fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const salaryDay = worker.salaryDay ?? 30
  const { endMonth: curEndMonth, endYear: curEndYear } = getCurrentPeriodEnd(salaryDay, now)
  const isCurrentPeriod = viewEndMonth === curEndMonth && viewEndYear === curEndYear

  const { startDate: periodStart, endDate: periodEnd } = getPeriodDates(viewEndMonth, viewEndYear, salaryDay)
  const monthAdvances = advancesForPeriod(worker, viewEndMonth, viewEndYear)
  const totalAdv = monthAdvances.reduce((s, a) => s + a.amount, 0)
  const netPay = Math.max(0, worker.monthlySalary - totalAdv)
  const paid = isMonthPaid(worker, viewEndMonth, viewEndYear)
  const payment = paymentForMonth(worker, viewEndMonth, viewEndYear)

  // Show pay day due banner when today >= pay day end date and not yet paid
  const payDayDue = isCurrentPeriod && now >= periodEnd && !paid

  // Unique period end months from payments + detected periods from advances
  const historyYears = Array.from(new Set([
    ...worker.payments.map((p) => p.year),
    ...worker.advances.map((a) => new Date(a.date).getFullYear()),
  ])).sort((a, b) => b - a)

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
          <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>← Workers</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', flex: 1 }} numberOfLines={1}>
            {worker.name}
          </Text>
          <TouchableOpacity onPress={openEditSheet} activeOpacity={0.7} style={{ marginRight: 12 }}>
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={{
          backgroundColor: '#141414',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#2A2A2A',
          padding: 16,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <TouchableOpacity onPress={handlePhotoTap} activeOpacity={0.8} style={{ marginRight: 14 }}>
            {uploadingPhoto ? (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#C8A84B" size="small" />
              </View>
            ) : worker.photo ? (
              <Image
                source={{ uri: worker.photo }}
                style={{ width: 64, height: 64, borderRadius: 32 }}
              />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A2A', borderStyle: 'dashed' }}>
                <Text style={{ fontSize: 28 }}>👷</Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#C8A84B', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 2 }}>{worker.name}</Text>
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{worker.position}</Text>
            <Text style={{ color: '#A0A0A0', fontSize: 12, marginBottom: 2 }}>
              📅 Pay day: every {worker.salaryDay ?? 30}{getOrdinal(worker.salaryDay ?? 30)} of the month
            </Text>
            {worker.address ? <Text style={{ color: '#A0A0A0', fontSize: 12, marginBottom: 2 }}>📍 {worker.address}</Text> : null}
            {worker.phoneNumber ? <Text style={{ color: '#A0A0A0', fontSize: 12, marginBottom: 2 }}>📞 {worker.phoneNumber}</Text> : null}
            {worker.fbLink ? <Text style={{ color: '#A0A0A0', fontSize: 12 }}>fb {worker.fbLink}</Text> : null}
          </View>
        </View>

        {/* Pay day due banner */}
        {payDayDue && (
          <View style={{
            backgroundColor: '#F59E0B22',
            borderWidth: 1,
            borderColor: '#F59E0B55',
            borderRadius: 12,
            padding: 12,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>
                Pay Day Reached
              </Text>
              <Text style={{ color: '#A0A0A0', fontSize: 12 }}>
                {worker.name} has {pesoFormat(netPay)} net pay due for this period.
              </Text>
            </View>
          </View>
        )}

        {/* Period nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <TouchableOpacity onPress={prevPeriod} activeOpacity={0.7} style={{ padding: 8 }}>
            <Text style={{ color: '#C8A84B', fontSize: 18 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
            {periodLabel(viewEndMonth, viewEndYear, salaryDay)}
          </Text>
          <TouchableOpacity
            onPress={nextPeriod}
            activeOpacity={0.7}
            style={{ padding: 8, opacity: isCurrentPeriod ? 0.3 : 1 }}
            disabled={isCurrentPeriod}
          >
            <Text style={{ color: '#C8A84B', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Salary summary card */}
        <View style={{
          backgroundColor: '#141414',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: paid ? '#22C55E44' : '#2A2A2A',
          padding: 16,
          marginBottom: 12,
        }}>
          {paid && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ backgroundColor: '#22C55E22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>PAID ✓</Text>
              </View>
              {payment ? (
                <Text style={{ color: '#606060', fontSize: 11, marginLeft: 8 }}>
                  {formatDate(payment.paidAt)}
                </Text>
              ) : null}
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={{ color: '#A0A0A0', fontSize: 13 }}>Gross Salary</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{pesoFormat(worker.monthlySalary)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={{ color: '#A0A0A0', fontSize: 13 }}>Total Advances</Text>
            <Text style={{ color: totalAdv > 0 ? '#EF4444' : '#A0A0A0', fontSize: 13, fontWeight: '600' }}>
              {totalAdv > 0 ? `- ${pesoFormat(totalAdv)}` : pesoFormat(0)}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Net Pay</Text>
            <Text style={{ color: '#C8A84B', fontSize: 15, fontWeight: '800' }}>{pesoFormat(netPay)}</Text>
          </View>
        </View>

        {/* Advances list */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', flex: 1 }}>
            ADVANCES {monthAdvances.length > 0 ? `(${monthAdvances.length})` : ''}
          </Text>
          {!paid && (
            <TouchableOpacity
              onPress={openAdvanceSheet}
              activeOpacity={0.8}
              style={{ backgroundColor: '#C8A84B22', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}
            >
              <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {monthAdvances.length === 0 ? (
          <View style={{
            backgroundColor: '#141414',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#1E1E1E',
            padding: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <Text style={{ color: '#606060', fontSize: 13 }}>No advances for this month</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 12 }}>
            {monthAdvances.map((adv) => (
              <View key={adv.id} style={{
                backgroundColor: '#141414',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#2A2A2A',
                padding: 12,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{pesoFormat(adv.amount)}</Text>
                  <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>{formatDate(adv.date)}</Text>
                  {adv.reason ? (
                    <Text style={{ color: '#A0A0A0', fontSize: 12, marginTop: 2 }}>{adv.reason}</Text>
                  ) : null}
                </View>
                {!paid && (
                  <TouchableOpacity
                    onPress={() => handleDeleteAdvance(adv)}
                    activeOpacity={0.7}
                    style={{ padding: 6 }}
                  >
                    <Text style={{ color: '#EF4444', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Mark as Paid / Payslip buttons */}
        {!paid ? (
          <TouchableOpacity
            onPress={handleMarkPaid}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#22C55E22',
              borderRadius: 10,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 10,
              borderWidth: 1,
              borderColor: '#22C55E44',
            }}
          >
            <Text style={{ color: '#22C55E', fontSize: 15, fontWeight: '700' }}>Mark as Paid</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={handleOpenExportSheet}
          activeOpacity={0.8}
          disabled={exportingPayslip}
          style={{
            backgroundColor: '#3B82F6',
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
            marginBottom: 20,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {exportingPayslip
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Text style={{ fontSize: 16 }}>🖼</Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Save Payslip</Text>
              </>
          }
        </TouchableOpacity>

        {/* Salary history */}
        {historyYears.length > 0 && (
          <View>
            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>SALARY HISTORY</Text>
            {historyYears.map((yr) => {
              const months = Array.from(new Set([
                ...worker.advances.filter((a) => {
                  const d = new Date(a.date)
                  const { endYear } = getCurrentPeriodEnd(salaryDay, d)
                  return endYear === yr
                }).map((a) => {
                  const d = new Date(a.date)
                  return getCurrentPeriodEnd(salaryDay, d).endMonth
                }),
                ...worker.payments.filter((p) => p.year === yr).map((p) => p.month),
              ])).sort((a, b) => b - a)

              return months.map((mo) => {
                const isViewing = mo === viewEndMonth && yr === viewEndYear
                const isPd = isMonthPaid(worker, mo, yr)
                const adv = advancesForPeriod(worker, mo, yr).reduce((s, a) => s + a.amount, 0)
                const net = Math.max(0, worker.monthlySalary - adv)
                return (
                  <TouchableOpacity
                    key={`${yr}-${mo}`}
                    onPress={() => { setViewEndMonth(mo); setViewEndYear(yr) }}
                    activeOpacity={0.75}
                    style={{
                      backgroundColor: isViewing ? '#1E1E1E' : '#141414',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isViewing ? '#C8A84B44' : '#2A2A2A',
                      padding: 12,
                      marginBottom: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#A0A0A0', fontSize: 13, flex: 1 }}>
                      {MONTH_NAMES[mo - 1]} {yr}
                    </Text>
                    <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700', marginRight: 10 }}>
                      {pesoFormat(net)}
                    </Text>
                    <View style={{
                      backgroundColor: isPd ? '#22C55E22' : '#EF444422',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}>
                      <Text style={{ color: isPd ? '#22C55E' : '#EF4444', fontSize: 10, fontWeight: '700' }}>
                        {isPd ? 'PAID' : 'UNPAID'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Advance Sheet */}
      <SimpleBottomSheet
        ref={advanceSheetRef}
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
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 20 }}>Add Advance</Text>

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>AMOUNT (₱) *</Text>
            <TextInput
              value={advAmount}
              onChangeText={setAdvAmount}
              placeholder="e.g. 3000"
              placeholderTextColor="#404040"
              keyboardType="numeric"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 16 }}
            />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>DATE *</Text>
            <TextInput
              value={advDate}
              onChangeText={setAdvDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#404040"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 16 }}
            />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>REASON (optional)</Text>
            <TextInput
              value={advReason}
              onChangeText={setAdvReason}
              placeholder="e.g. Emergency"
              placeholderTextColor="#404040"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 24 }}
            />

            <TouchableOpacity
              onPress={handleAddAdvance}
              activeOpacity={0.8}
              disabled={addingAdvance || !advAmount || !advDate}
              style={{
                backgroundColor: addingAdvance || !advAmount || !advDate ? '#2A2A2A' : '#C8A84B',
                borderRadius: 10, paddingVertical: 14, alignItems: 'center',
              }}
            >
              <Text style={{ color: addingAdvance || !advAmount || !advDate ? '#606060' : '#0A0A0A', fontSize: 15, fontWeight: '700' }}>
                {addingAdvance ? 'Adding...' : 'Add Advance'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheetView>
      </SimpleBottomSheet>

      {/* Edit Worker Sheet */}
      <SimpleBottomSheet
        ref={editSheetRef}
        snapPoints={['90%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
      >
        <BottomSheetView>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 220 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 20 }}>Edit Worker</Text>

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>NAME *</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Worker name"
              placeholderTextColor="#404040"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 16 }}
            />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>POSITION *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {POSITION_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => { setEditPosition(p); setEditShowCustom(false) }}
                  activeOpacity={0.75}
                  style={{
                    borderRadius: 20, borderWidth: 1,
                    borderColor: editPosition === p && !editShowCustom ? '#C8A84B' : '#2A2A2A',
                    backgroundColor: editPosition === p && !editShowCustom ? '#C8A84B22' : '#1E1E1E',
                    paddingHorizontal: 12, paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: editPosition === p && !editShowCustom ? '#C8A84B' : '#A0A0A0', fontSize: 12, fontWeight: '600' }}>{p}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => { setEditShowCustom(true); setEditPosition('') }}
                activeOpacity={0.75}
                style={{
                  borderRadius: 20, borderWidth: 1,
                  borderColor: editShowCustom ? '#C8A84B' : '#2A2A2A',
                  backgroundColor: editShowCustom ? '#C8A84B22' : '#1E1E1E',
                  paddingHorizontal: 12, paddingVertical: 6,
                }}
              >
                <Text style={{ color: editShowCustom ? '#C8A84B' : '#A0A0A0', fontSize: 12, fontWeight: '600' }}>Custom</Text>
              </TouchableOpacity>
            </View>
            {editShowCustom && (
              <TextInput
                value={editCustomPosition}
                onChangeText={setEditCustomPosition}
                placeholder="Enter custom position"
                placeholderTextColor="#404040"
                style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#C8A84B', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 4 }}
              />
            )}
            <View style={{ marginBottom: 16 }} />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>MONTHLY SALARY (₱) *</Text>
            <TextInput
              value={editSalary}
              onChangeText={setEditSalary}
              keyboardType="numeric"
              placeholder="e.g. 10000"
              placeholderTextColor="#404040"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 16 }}
            />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>PAY DAY (day of month) *</Text>
            <Text style={{ color: '#606060', fontSize: 11, marginBottom: 6 }}>Which day each month is salary due? (e.g. 12 = every 12th)</Text>
            <TextInput
              value={editSalaryDay}
              onChangeText={setEditSalaryDay}
              keyboardType="numeric"
              maxLength={2}
              placeholder="30"
              placeholderTextColor="#404040"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 16 }}
            />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>ADDRESS (optional)</Text>
            <TextInput
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="e.g. Batangas, PH"
              placeholderTextColor="#404040"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 16 }}
            />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>PHONE NUMBER (optional)</Text>
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="e.g. 09XX-XXX-XXXX"
              placeholderTextColor="#404040"
              keyboardType="phone-pad"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 16 }}
            />

            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>FACEBOOK LINK (optional)</Text>
            <TextInput
              value={editFb}
              onChangeText={setEditFb}
              placeholder="e.g. facebook.com/juandelacruz"
              placeholderTextColor="#404040"
              style={{ backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', fontSize: 15, padding: 12, marginBottom: 24 }}
            />

            <TouchableOpacity
              onPress={handleSaveEdit}
              activeOpacity={0.8}
              disabled={saving || !editName.trim() || !(editShowCustom ? editCustomPosition.trim() : editPosition)}
              style={{
                backgroundColor: saving || !editName.trim() || !(editShowCustom ? editCustomPosition.trim() : editPosition) ? '#2A2A2A' : '#C8A84B',
                borderRadius: 10, paddingVertical: 14, alignItems: 'center',
              }}
            >
              <Text style={{
                color: saving || !editName.trim() || !(editShowCustom ? editCustomPosition.trim() : editPosition) ? '#606060' : '#0A0A0A',
                fontSize: 15, fontWeight: '700',
              }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheetView>
      </SimpleBottomSheet>

      {/* Export payslip customization sheet */}
      <SimpleBottomSheet
        ref={exportSheetRef}
        snapPoints={['72%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#A0A0A0' }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Customize Payslip</Text>
          <Text style={{ color: '#606060', fontSize: 13, marginBottom: 20 }}>These details will appear on the saved image.</Text>

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Farm Name</Text>
          <TextInput
            value={farmName}
            onChangeText={setFarmName}
            placeholder="e.g. Dela Cruz Gamefarm"
            placeholderTextColor="#404040"
            style={{ backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, color: '#FFFFFF', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}
          />

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Owner Name</Text>
          <TextInput
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Juan Dela Cruz"
            placeholderTextColor="#404040"
            style={{ backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, color: '#FFFFFF', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 }}
          />

          <TouchableOpacity
            onPress={handleConfirmExport}
            disabled={exportingPayslip}
            activeOpacity={0.85}
            style={{ backgroundColor: '#C8A84B', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            {exportingPayslip
              ? <ActivityIndicator color="#000000" />
              : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>Save to Photos</Text>
            }
          </TouchableOpacity>
        </BottomSheetScrollView>
      </SimpleBottomSheet>

      {/* Payslip card — rendered off-screen for capture */}
      {worker && (
        <WorkerPayslipCard
          ref={payslipCardRef}
          farmName={farmName}
          ownerName={ownerName}
          worker={worker}
          month={viewEndMonth}
          year={viewEndYear}
          advances={monthAdvances}
          netPay={netPay}
          paidAt={payment?.paidAt ?? null}
        />
      )}

      {/* Photo viewer modal */}
      <Modal visible={!!photoModalUri} transparent animationType="fade" onRequestClose={() => setPhotoModalUri(null)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={1}
          onPress={() => setPhotoModalUri(null)}
        >
          {photoModalUri && (
            <Image source={{ uri: photoModalUri }} style={{ width: '90%', height: '70%', borderRadius: 12 }} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  )
}
