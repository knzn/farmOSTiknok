import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { captureRef } from 'react-native-view-shot'
import * as MediaLibrary from 'expo-media-library'
import * as SecureStore from 'expo-secure-store'
import SimpleBottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
  type SimpleBottomSheetRef,
} from '../../../../../components/SimpleBottomSheet'
import ExpenseReportCard from '../../../../../components/ExpenseReportCard'
import { apiRequest, apiUpload } from '../../../../../lib/api'
import { useToastStore } from '../../../../../stores/toast'

// ─── types ───────────────────────────────────────────────────────────────────

type ExpenseCategory =
  | 'feeds' | 'vitamins' | 'medicines' | 'deworming'
  | 'workers_extra_budget' | 'miscellaneous'

type ExpenseType = 'unit' | 'direct'

interface Expense {
  id: string
  category: ExpenseCategory
  type: ExpenseType
  date: string
  month: number
  year: number
  name: string | null
  unit: string | null
  quantity: number | null
  pricePerUnit: number | null
  totalAmount: number
  description: string | null
  amount: number | null
  receiptUrl: string | null
  notes: string | null
  locked: boolean
}

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORY_TYPE: Record<ExpenseCategory, ExpenseType> = {
  feeds:                'unit',
  vitamins:             'unit',
  medicines:            'unit',
  deworming:            'unit',
  workers_extra_budget: 'direct',
  miscellaneous:        'direct',
}

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  feeds:                'Feeds',
  vitamins:             'Vitamins',
  medicines:            'Medicines',
  deworming:            'Deworming',
  workers_extra_budget: 'Workers Extra Budget',
  miscellaneous:        'Miscellaneous',
}

const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  feeds:                '🌾',
  vitamins:             '💊',
  medicines:            '🩺',
  deworming:            '🪱',
  workers_extra_budget: '👷',
  miscellaneous:        '📦',
}

const CATEGORY_PLACEHOLDER: Record<ExpenseCategory, string> = {
  feeds:                'e.g. Thunderbird, Salto',
  vitamins:             'e.g. Bexan, B50, Respigen, Vitaminpro',
  medicines:            'e.g. Abroxytyl, Doxylac, L-Spec',
  deworming:            'e.g. Astig, Hammer, Strongguard',
  workers_extra_budget: '',
  miscellaneous:        'e.g. Transportation, Electricity, Mowing, Disinfection',
}

const UNIT_OPTIONS_FEEDS = ['Kilo', 'Sacks']
const UNIT_OPTIONS_MED   = ['Kilo', 'Box', 'Sachet', '100mL', '10mL', 'Tablet/Capsule']

const UNIT_OPTIONS: Record<ExpenseCategory, string[]> = {
  feeds:                UNIT_OPTIONS_FEEDS,
  vitamins:             UNIT_OPTIONS_MED,
  medicines:            UNIT_OPTIONS_MED,
  deworming:            UNIT_OPTIONS_MED,
  workers_extra_budget: [],
  miscellaneous:        [],
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const ALL_CATEGORIES: ExpenseCategory[] = [
  'feeds', 'vitamins', 'medicines', 'deworming', 'workers_extra_budget', 'miscellaneous',
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function pesoFormat(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function expenseRowLabel(e: Expense): string {
  if (e.type === 'unit') return e.name ?? ''
  return e.description ?? CATEGORY_LABEL[e.category]
}

function expenseRowSub(e: Expense): string {
  if (e.type === 'unit' && e.quantity != null && e.unit) {
    const priceStr = e.pricePerUnit != null ? ` · ${pesoFormat(e.pricePerUnit)}/${e.unit}` : ''
    return `${e.quantity} ${e.unit}${priceStr}`
  }
  return ''
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <Text style={{
      color: '#A0A0A0', fontSize: 11, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 16,
    }}>
      {text}
    </Text>
  )
}

function InputLabel({ text }: { text: string }) {
  return (
    <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
      {text}
    </Text>
  )
}

function StyledInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#404040"
      style={{
        backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A',
        borderRadius: 10, color: '#FFFFFF', fontSize: 15,
        paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
      }}
      {...props}
    />
  )
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const router = useRouter()
  const showToast = useToastStore((s) => s.show)
  const sheetRef       = useRef<SimpleBottomSheetRef>(null)
  const exportSheetRef = useRef<SimpleBottomSheetRef>(null)
  const reportCardRef  = useRef<View>(null)

  const now = new Date()
  const [currentMonth]   = useState(now.getMonth() + 1)
  const [currentYear]    = useState(now.getFullYear())

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)


  // ── sheet state ────────────────────────────────────────────────────────────
  type SheetStep = 'category' | 'form'
  const [sheetStep, setSheetStep]         = useState<SheetStep>('category')
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [formCategory, setFormCategory]   = useState<ExpenseCategory | null>(null)

  // form fields
  const [fName, setFName]           = useState('')
  const [fUnit, setFUnit]           = useState('')
  const [fQty, setFQty]             = useState('')
  const [fPrice, setFPrice]         = useState('')
  const [fDescription, setFDesc]    = useState('')
  const [fAmount, setFAmount]       = useState('')
  const [fDate, setFDate]           = useState(todayISO())
  const [fNotes, setFNotes]         = useState('')
  const [fReceiptUri, setFReceiptUri] = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)

  // export
  const [farmName, setFarmName]       = useState('')
  const [ownerName, setOwnerName]     = useState('')
  const [exporting, setExporting]     = useState(false)

  useEffect(() => {
    SecureStore.getItemAsync('tiknok_farm_name').then((v) => v && setFarmName(v))
    SecureStore.getItemAsync('tiknok_owner_name').then((v) => v && setOwnerName(v))
  }, [])

  // ── data loading ───────────────────────────────────────────────────────────

  async function loadExpenses() {
    try {
      setError(null)
      const current = await apiRequest<Expense[]>(`/expenses?month=${currentMonth}&year=${currentYear}`)
      setExpenses(current)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => {
    setLoading(true)
    loadExpenses()
  }, []))


  // ── computed ───────────────────────────────────────────────────────────────

  const categoryTotals = ALL_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.totalAmount, 0)
    return acc
  }, {} as Record<ExpenseCategory, number>)

  const monthTotal = expenses.reduce((s, e) => s + e.totalAmount, 0)

  const grouped = ALL_CATEGORIES.reduce((acc, cat) => {
    const items = expenses.filter((e) => e.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Partial<Record<ExpenseCategory, Expense[]>>)

  // ── sheet helpers ──────────────────────────────────────────────────────────

  function resetForm() {
    setFName(''); setFUnit(''); setFQty(''); setFPrice('')
    setFDesc(''); setFAmount(''); setFDate(todayISO())
    setFNotes(''); setFReceiptUri(null)
    setFormError(null)
  }

  function openAdd() {
    resetForm()
    setEditingId(null)
    setFormCategory(null)
    setSheetStep('category')
    sheetRef.current?.expand()
  }

  function openEdit(e: Expense) {
    resetForm()
    setEditingId(e.id)
    setFormCategory(e.category)
    if (e.type === 'unit') {
      setFName(e.name ?? '')
      setFUnit(e.unit ?? '')
      setFQty(e.quantity != null ? String(e.quantity) : '')
      setFPrice(e.pricePerUnit != null ? String(e.pricePerUnit) : '')
    } else {
      setFDesc(e.description ?? '')
      setFAmount(e.amount != null ? String(e.amount) : '')
    }
    setFDate(e.date.split('T')[0])
    setFNotes(e.notes ?? '')
    setSheetStep('form')
    sheetRef.current?.expand()
  }

  function selectCategory(cat: ExpenseCategory) {
    setFormCategory(cat)
    setFUnit(UNIT_OPTIONS[cat][0] ?? '')
    setSheetStep('form')
  }

  // ── submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!formCategory) return
    setFormError(null)
    const type = CATEGORY_TYPE[formCategory]

    if (type === 'unit') {
      if (!fName.trim())  return setFormError('Product name is required.')
      if (!fUnit)         return setFormError('Unit is required.')
      if (!fQty.trim())   return setFormError('Quantity is required.')
      if (!fPrice.trim()) return setFormError('Price per unit is required.')
    } else if (formCategory === 'miscellaneous') {
      if (!fDescription.trim()) return setFormError('Description is required.')
      if (!fAmount.trim())      return setFormError('Amount is required.')
    }

    setSubmitting(true)
    try {
      let body: Record<string, unknown> = { category: formCategory, date: fDate }

      if (type === 'unit') {
        body = { ...body, name: fName.trim(), unit: fUnit, quantity: parseFloat(fQty), pricePerUnit: parseFloat(fPrice) }
      } else if (formCategory === 'workers_extra_budget') {
        body = { ...body, amount: fAmount.trim() ? parseFloat(fAmount) : 0 }
      } else {
        body = { ...body, description: fDescription.trim(), amount: parseFloat(fAmount) }
      }
      if (fNotes.trim()) body.notes = fNotes.trim()

      let saved: Expense
      if (editingId) {
        saved = await apiRequest<Expense>(`/expenses/${editingId}`, { method: 'PATCH', body })
      } else {
        saved = await apiRequest<Expense>('/expenses', { method: 'POST', body })
      }

      // Upload receipt if picked (add only, not edit re-upload for simplicity)
      if (fReceiptUri && !editingId) {
        try {
          const updated = await apiUpload<Expense>(`/expenses/${saved.id}/receipt`, fReceiptUri)
          saved = updated
        } catch { /* receipt upload failure is non-blocking */ }
      }

      setExpenses((prev) =>
        editingId
          ? prev.map((e) => (e.id === editingId ? saved : e))
          : [saved, ...prev]
      )
      showToast(editingId ? 'Expense updated' : 'Expense added')
      sheetRef.current?.close()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save expense.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExport() {
    await SecureStore.setItemAsync('tiknok_farm_name', farmName)
    await SecureStore.setItemAsync('tiknok_owner_name', ownerName)
    exportSheetRef.current?.close()
    setExporting(true)
    try {
      await new Promise((r) => setTimeout(r, 350))
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow access to your photo library to save the report.')
        return
      }
      const uri = await captureRef(reportCardRef, { format: 'png', quality: 1 })
      await MediaLibrary.saveToLibraryAsync(uri)
      Alert.alert('Saved!', 'Expense report saved to your Photos.')
    } catch {
      Alert.alert('Error', 'Could not save report. Try again.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete(expense: Expense) {
    Alert.alert(
      'Delete Expense',
      `Delete this ${CATEGORY_LABEL[expense.category]} entry? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/expenses/${expense.id}`, { method: 'DELETE' })
              setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete.')
            }
          },
        },
      ]
    )
  }

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      setFReceiptUri(result.assets[0].uri)
    }
  }

  // ── computed for form preview ──────────────────────────────────────────────

  const previewTotal = (() => {
    const qty = parseFloat(fQty)
    const price = parseFloat(fPrice)
    if (!isNaN(qty) && !isNaN(price)) return qty * price
    return null
  })()

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
        paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }} activeOpacity={0.7}>
          <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>← Farm Finance</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>Farm Expenses</Text>
            <Text style={{ color: '#A0A0A0', fontSize: 13, marginTop: 2 }}>
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/breeder/finance/expenses/history' as any)}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#1E1E1E',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#2A2A2A',
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '700' }}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color="#C8A84B" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={{ color: '#EF4444', textAlign: 'center', marginTop: 40 }}>{error}</Text>
        ) : (
          <>
            {/* Month summary card */}
            <View style={{
              backgroundColor: '#141414', borderRadius: 16, borderWidth: 1,
              borderColor: '#2A2A2A', padding: 16, marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <Text style={{ color: '#A0A0A0', fontSize: 13 }}>Total this month</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>
                  {pesoFormat(monthTotal)}
                </Text>
              </View>
              {ALL_CATEGORIES.filter((cat) => categoryTotals[cat] > 0).map((cat) => (
                <View key={cat} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ color: '#606060', fontSize: 13 }}>
                    {CATEGORY_EMOJI[cat]} {CATEGORY_LABEL[cat]}
                  </Text>
                  <Text style={{ color: '#A0A0A0', fontSize: 13, fontWeight: '600' }}>
                    {pesoFormat(categoryTotals[cat])}
                  </Text>
                </View>
              ))}
              {monthTotal === 0 && (
                <Text style={{ color: '#404040', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                  No expenses recorded yet.
                </Text>
              )}
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={openAdd}
                activeOpacity={0.85}
                style={{
                  flex: 1, backgroundColor: '#C8A84B',
                  borderRadius: 12, paddingVertical: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#0A0A0A', fontSize: 15, fontWeight: '700' }}>+ Add Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => exportSheetRef.current?.expand()}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#3B82F6', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 6,
                }}
              >
                <Text style={{ fontSize: 15 }}>🖼</Text>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Save as Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Grouped entries */}
            {(Object.entries(grouped) as [ExpenseCategory, Expense[]][]).map(([cat, items]) => (
              <View key={cat} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {CATEGORY_EMOJI[cat]} {CATEGORY_LABEL[cat]}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: '#1E1E1E', marginLeft: 10 }} />
                  <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginLeft: 10 }}>
                    {pesoFormat(categoryTotals[cat])}
                  </Text>
                </View>

                {items.map((expense) => (
                  <View
                    key={expense.id}
                    style={{
                      backgroundColor: '#141414', borderRadius: 10, borderWidth: 1,
                      borderColor: '#2A2A2A', padding: 12, marginBottom: 8,
                      flexDirection: 'row', alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 2 }}>
                        {expenseRowLabel(expense)}
                      </Text>
                      {expenseRowSub(expense) ? (
                        <Text style={{ color: '#606060', fontSize: 12, marginBottom: 2 }}>
                          {expenseRowSub(expense)}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: '#A0A0A0', fontSize: 12 }}>
                          {new Date(expense.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </Text>
                        {expense.receiptUrl ? (
                          <Text style={{ color: '#606060', fontSize: 11 }}>🧾</Text>
                        ) : null}
                        {expense.notes ? (
                          <Text style={{ color: '#606060', fontSize: 11 }}>📝</Text>
                        ) : null}
                        {expense.locked ? (
                          <Text style={{ color: '#606060', fontSize: 11 }}>🔒</Text>
                        ) : null}
                      </View>
                    </View>

                    <Text style={{ color: '#C8A84B', fontSize: 14, fontWeight: '700', marginHorizontal: 12 }}>
                      {pesoFormat(expense.totalAmount)}
                    </Text>

                    {!expense.locked && (
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity
                          onPress={() => openEdit(expense)}
                          activeOpacity={0.7}
                          style={{
                            backgroundColor: '#1E1E1E', borderRadius: 8,
                            paddingHorizontal: 10, paddingVertical: 6,
                          }}
                        >
                          <Text style={{ color: '#A0A0A0', fontSize: 13 }}>✏</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(expense)}
                          activeOpacity={0.7}
                          style={{
                            backgroundColor: '#1E1E1E', borderRadius: 8,
                            paddingHorizontal: 10, paddingVertical: 6,
                          }}
                        >
                          <Text style={{ color: '#EF4444', fontSize: 13 }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Export report sheet */}
      <SimpleBottomSheet
        ref={exportSheetRef}
        snapPoints={['45%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#A0A0A0' }}
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
            Save Expense Report
          </Text>
          <Text style={{ color: '#606060', fontSize: 13, marginBottom: 20 }}>
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </Text>

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Farm Name
          </Text>
          <TextInput
            value={farmName}
            onChangeText={setFarmName}
            placeholder="e.g. Dela Cruz Gamefarm"
            placeholderTextColor="#404040"
            style={{ backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, color: '#FFFFFF', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}
          />

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Owner Name
          </Text>
          <TextInput
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Juan Dela Cruz"
            placeholderTextColor="#404040"
            style={{ backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, color: '#FFFFFF', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 }}
          />

          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.85}
            style={{ backgroundColor: '#C8A84B', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
          >
            {exporting
              ? <ActivityIndicator color="#000000" />
              : <Text style={{ color: '#0A0A0A', fontSize: 15, fontWeight: '700' }}>📷 Save to Photos</Text>
            }
          </TouchableOpacity>
        </BottomSheetView>
      </SimpleBottomSheet>

      {/* Hidden expense report card for capture */}
      <ExpenseReportCard
        ref={reportCardRef}
        farmName={farmName}
        ownerName={ownerName}
        month={currentMonth}
        year={currentYear}
        expenses={expenses}
      />

      {/* Add / Edit bottom sheet */}
      <SimpleBottomSheet
        ref={sheetRef}
        snapPoints={['90%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#A0A0A0' }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 220 }}
          keyboardShouldPersistTaps="handled"
        >
          {sheetStep === 'category' ? (
            <>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
                Add Expense
              </Text>
              <Text style={{ color: '#606060', fontSize: 13, marginBottom: 20 }}>
                Select a category
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {ALL_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => selectCategory(cat)}
                    activeOpacity={0.8}
                    style={{
                      width: '47%',
                      backgroundColor: '#1E1E1E', borderRadius: 12,
                      borderWidth: 1, borderColor: '#2A2A2A',
                      padding: 16, alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>{CATEGORY_EMOJI[cat]}</Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                      {CATEGORY_LABEL[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : formCategory ? (
            <>
              {/* Form header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                {!editingId && (
                  <TouchableOpacity onPress={() => setSheetStep('category')} activeOpacity={0.7} style={{ marginRight: 12 }}>
                    <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>← Back</Text>
                  </TouchableOpacity>
                )}
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', flex: 1 }}>
                  {editingId ? 'Edit' : 'Add'} {CATEGORY_LABEL[formCategory]}
                </Text>
              </View>

              {/* unit type fields */}
              {CATEGORY_TYPE[formCategory] === 'unit' && (
                <>
                  <InputLabel text="Product Name" />
                  <StyledInput
                    value={fName}
                    onChangeText={setFName}
                    placeholder={CATEGORY_PLACEHOLDER[formCategory]}
                  />

                  <InputLabel text="Unit" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {UNIT_OPTIONS[formCategory].map((u) => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setFUnit(u)}
                        activeOpacity={0.8}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                          borderWidth: 1,
                          backgroundColor: fUnit === u ? '#C8A84B22' : '#0A0A0A',
                          borderColor: fUnit === u ? '#C8A84B' : '#2A2A2A',
                        }}
                      >
                        <Text style={{ color: fUnit === u ? '#C8A84B' : '#606060', fontWeight: '600', fontSize: 13 }}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <InputLabel text="Quantity" />
                  <StyledInput
                    value={fQty}
                    onChangeText={(v) => setFQty(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <InputLabel text="Price per Unit (₱)" />
                  <StyledInput
                    value={fPrice}
                    onChangeText={(v) => setFPrice(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />

                  {previewTotal != null && (
                    <View style={{ marginBottom: 16 }}>
                      <View style={{
                        flexDirection: 'row', justifyContent: 'space-between',
                        backgroundColor: '#0A0A0A', borderRadius: 10, borderWidth: 1,
                        borderColor: '#2A2A2A', paddingHorizontal: 14, paddingVertical: 12,
                      }}>
                        <Text style={{ color: '#A0A0A0', fontSize: 14 }}>Total</Text>
                        <Text style={{ color: '#C8A84B', fontSize: 14, fontWeight: '700' }}>
                          {pesoFormat(previewTotal)}
                        </Text>
                      </View>
                      <Text style={{ color: '#606060', fontSize: 11, marginTop: 5, paddingHorizontal: 2 }}>Computed automatically. Qty × Price.</Text>
                    </View>
                  )}
                </>
              )}

              {/* workers_extra_budget fields */}
              {formCategory === 'workers_extra_budget' && (
                <>
                  <InputLabel text="Amount (₱)" />
                  <StyledInput
                    value={fAmount}
                    onChangeText={(v) => setFAmount(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </>
              )}

              {/* miscellaneous fields */}
              {formCategory === 'miscellaneous' && (
                <>
                  <InputLabel text="Description" />
                  <StyledInput
                    value={fDescription}
                    onChangeText={setFDesc}
                    placeholder={CATEGORY_PLACEHOLDER.miscellaneous}
                  />
                  <InputLabel text="Amount (₱)" />
                  <StyledInput
                    value={fAmount}
                    onChangeText={(v) => setFAmount(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </>
              )}

              {/* Date — all categories */}
              <InputLabel text="Date" />
              <StyledInput
                value={fDate}
                onChangeText={setFDate}
                placeholder="YYYY-MM-DD"
                keyboardType="numeric"
              />

              {/* Notes — all categories */}
              <InputLabel text="Notes (optional)" />
              <StyledInput
                value={fNotes}
                onChangeText={setFNotes}
                placeholder='e.g. "Bulk buy", "Split with another farm"'
              />

              {/* Receipt — unit types only */}
              {CATEGORY_TYPE[formCategory] === 'unit' && (
                <TouchableOpacity
                  onPress={pickReceipt}
                  activeOpacity={0.8}
                  style={{
                    borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10,
                    paddingVertical: 12, alignItems: 'center', marginBottom: 20,
                    backgroundColor: fReceiptUri ? '#C8A84B22' : '#0A0A0A',
                  }}
                >
                  <Text style={{ color: fReceiptUri ? '#C8A84B' : '#606060', fontSize: 14 }}>
                    {fReceiptUri ? '🧾 Receipt selected' : '📷 Upload Receipt (optional)'}
                  </Text>
                </TouchableOpacity>
              )}

              {formError ? (
                <View style={{
                  backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10,
                  padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                }}>
                  <Text style={{ color: '#EF4444', fontSize: 13 }}>{formError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#C8A84B', borderRadius: 12,
                  paddingVertical: 16, alignItems: 'center',
                }}
              >
                {submitting
                  ? <ActivityIndicator color="#000000" />
                  : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>
                      {editingId ? 'Save Changes' : 'Add Expense'}
                    </Text>
                }
              </TouchableOpacity>
            </>
          ) : null}
        </BottomSheetScrollView>
      </SimpleBottomSheet>
    </View>
  )
}
