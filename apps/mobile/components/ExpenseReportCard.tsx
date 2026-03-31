import { forwardRef } from 'react'
import { View, Text } from 'react-native'

const CARD_WIDTH = 340

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CATEGORY_LABEL: Record<string, string> = {
  feeds:                'Feeds',
  vitamins:             'Vitamins',
  medicines:            'Medicines',
  deworming:            'Deworming',
  workers_extra_budget: 'Workers Extra Budget',
  miscellaneous:        'Miscellaneous',
}

const CATEGORY_EMOJI: Record<string, string> = {
  feeds:                '🌾',
  vitamins:             '💊',
  medicines:            '🩺',
  deworming:            '🪱',
  workers_extra_budget: '👷',
  miscellaneous:        '📦',
}

const ALL_CATEGORIES = [
  'feeds', 'vitamins', 'medicines', 'deworming', 'workers_extra_budget', 'miscellaneous',
]

function pesoFormat(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Divider({ dashed }: { dashed?: boolean }) {
  if (dashed) {
    return (
      <Text style={{ color: '#2A2A2A', fontSize: 10, letterSpacing: 2, marginVertical: 10 }}>
        {'- - - - - - - - - - - - - - - - - - - - - - - - -'}
      </Text>
    )
  }
  return <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 10 }} />
}

export interface ExpenseItem {
  id: string
  category: string
  type: 'unit' | 'direct'
  date: string
  name: string | null
  unit: string | null
  quantity: number | null
  pricePerUnit: number | null
  totalAmount: number
  description: string | null
  amount: number | null
  notes: string | null
}

export interface ExpenseReportCardProps {
  farmName: string
  ownerName: string
  month: number   // 1–12
  year: number
  expenses: ExpenseItem[]
  isHistory?: boolean
}

const ExpenseReportCard = forwardRef<View, ExpenseReportCardProps>((props, ref) => {
  const { farmName, ownerName, month, year, expenses, isHistory } = props

  const displayFarm  = farmName.trim() || 'TIKNOK'
  const displayOwner = ownerName.trim()

  const now = new Date()
  const generatedDate = now.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // Header subtitle: current month shows full range, history shows "Month Year" only
  const headerDate = isHistory
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : `${MONTH_NAMES[month - 1]} 1 - ${MONTH_NAMES[month - 1]} ${now.getDate()}, ${year}`

  // Period line always shows Month 1 → today
  const dateRange = `${MONTH_NAMES[month - 1]} 1 - ${MONTH_NAMES[month - 1]} ${now.getDate()}, ${year}`

  // Group by category
  const grouped = ALL_CATEGORIES.reduce((acc, cat) => {
    const items = expenses.filter((e) => e.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<string, ExpenseItem[]>)

  const grandTotal = expenses.reduce((s, e) => s + e.totalAmount, 0)

  return (
    <View
      ref={ref}
      style={{
        width: CARD_WIDTH,
        backgroundColor: '#0A0A0A',
        paddingHorizontal: 18,
        paddingVertical: 20,
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Farm header */}
      <Text style={{
        color: '#FFFFFF', fontSize: 15, fontWeight: '800',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
      }}>
        {displayFarm}
      </Text>
      {displayOwner ? (
        <Text style={{ color: '#A0A0A0', fontSize: 12, marginBottom: 2 }}>{displayOwner}</Text>
      ) : null}
      <Text style={{
        color: '#C8A84B', fontSize: 10, fontWeight: '700',
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 1,
      }}>
        Expense Report
      </Text>
      <Text style={{ color: '#606060', fontSize: 11 }}>{headerDate}</Text>

      <Divider dashed />

      {/* Period */}
      <Text style={{ color: '#A0A0A0', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>
        Period
      </Text>
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
        {dateRange}
      </Text>

      <Divider dashed />

      {/* Categories with line items */}
      {Object.entries(grouped).map(([cat, items]) => {
        const catTotal = items.reduce((s, e) => s + e.totalAmount, 0)
        return (
          <View key={cat} style={{ marginBottom: 10 }}>
            {/* Category header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                {CATEGORY_EMOJI[cat]}  {CATEGORY_LABEL[cat]}
              </Text>
              <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '800' }}>
                {pesoFormat(catTotal)}
              </Text>
            </View>

            {/* Line items */}
            {items.map((e) => {
              const label = e.type === 'unit'
                ? (e.name ?? '')
                : (e.description ?? CATEGORY_LABEL[cat])
              const sub = e.type === 'unit' && e.quantity != null && e.unit
                ? `${e.quantity} ${e.unit}${e.pricePerUnit != null ? ` × ${pesoFormat(e.pricePerUnit)}` : ''}`
                : null
              return (
                <View
                  key={e.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    paddingLeft: 10,
                    paddingVertical: 2,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '500' }}>{label}</Text>
                    {sub ? (
                      <Text style={{ color: '#606060', fontSize: 10, marginTop: 1 }}>{sub}</Text>
                    ) : null}
                  </View>
                  <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: '600' }}>
                    {pesoFormat(e.totalAmount)}
                  </Text>
                </View>
              )
            })}
          </View>
        )
      })}

      {expenses.length === 0 && (
        <Text style={{ color: '#404040', fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>
          No expenses recorded.
        </Text>
      )}

      <Divider />

      {/* Grand total */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>TOTAL</Text>
        <Text style={{ color: '#C8A84B', fontSize: 17, fontWeight: '800' }}>
          {pesoFormat(grandTotal)}
        </Text>
      </View>

      <Divider dashed />

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#404040', fontSize: 10 }}>Generated: {generatedDate}</Text>
        <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>TIKNOK</Text>
      </View>
    </View>
  )
})

ExpenseReportCard.displayName = 'ExpenseReportCard'
export default ExpenseReportCard
