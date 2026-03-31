import { forwardRef } from 'react'
import { View, Text, Image } from 'react-native'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CARD_WIDTH = 360

function pesoFormat(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function getOrdinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 12 }} />
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ color: '#A0A0A0', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: valueColor ?? '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

export type PayslipAdvance = {
  id: string
  amount: number
  reason: string | null
  date: string
  month: number
  year: number
}

export type WorkerPayslipProps = {
  farmName: string
  ownerName: string
  worker: {
    name: string
    position: string
    monthlySalary: number
    salaryDay: number
    photo: string | null
    address: string | null
    phoneNumber: string | null
    fbLink: string | null
  }
  month: number
  year: number
  advances: PayslipAdvance[]
  netPay: number
  paidAt: string | null  // ISO date string if already paid
}

const WorkerPayslipCard = forwardRef<View, WorkerPayslipProps>((props, ref) => {
  const { farmName, ownerName, worker, month, year, advances, netPay, paidAt } = props

  const displayFarm = farmName.trim() || 'TIKNOK'
  const displayOwner = ownerName.trim()
  const totalAdvances = advances.reduce((s, a) => s + a.amount, 0)
  const generatedDate = new Date().toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <View
      ref={ref}
      style={{
        width: CARD_WIDTH,
        backgroundColor: '#0A0A0A',
        padding: 20,
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Farm header */}
      <Text style={{
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
      }}>
        {displayFarm}
      </Text>
      {displayOwner ? (
        <Text style={{ color: '#A0A0A0', fontSize: 13, marginBottom: 2 }}>{displayOwner}</Text>
      ) : null}
      <Text style={{ color: '#C8A84B', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
        Pay Slip
      </Text>
      <Text style={{ color: '#606060', fontSize: 12 }}>
        {generatedDate}
      </Text>

      <Divider />

      {/* Worker profile */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        {worker.photo ? (
          <Image
            source={{ uri: worker.photo }}
            style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12, backgroundColor: '#1E1E1E' }}
          />
        ) : (
          <View style={{
            width: 56, height: 56, borderRadius: 28, marginRight: 12,
            backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: '#2A2A2A',
          }}>
            <Text style={{ fontSize: 26 }}>👷</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>{worker.name}</Text>
          <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '600' }}>{worker.position}</Text>
          <Text style={{ color: '#606060', fontSize: 11, marginTop: 2 }}>Every {getOrdinal(worker.salaryDay)} of the month</Text>
          {worker.address ? (
            <Text style={{ color: '#A0A0A0', fontSize: 11, marginTop: 2 }}>📍 {worker.address}</Text>
          ) : null}
          {worker.phoneNumber ? (
            <Text style={{ color: '#A0A0A0', fontSize: 11, marginTop: 1 }}>📞 {worker.phoneNumber}</Text>
          ) : null}
        </View>
      </View>

      <Divider />

      {/* Salary breakdown */}
      <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
        Salary Breakdown
      </Text>
      <Text style={{ color: '#606060', fontSize: 11, marginBottom: 8 }}>
        {MONTH_NAMES[month - 1]} {year}
      </Text>

      <Row label="Gross Salary" value={pesoFormat(worker.monthlySalary)} />

      {totalAdvances > 0 ? (
        <>
          <Row
            label="Total Advances"
            value={`- ${pesoFormat(totalAdvances)}`}
            valueColor="#EF4444"
          />
          {/* Advances detail */}
          <View style={{ marginTop: 4, marginBottom: 4, paddingLeft: 12 }}>
            {advances.map((adv) => (
              <View key={adv.id} style={{ flexDirection: 'row', paddingVertical: 2 }}>
                <Text style={{ color: '#606060', fontSize: 11, flex: 1 }}>
                  {formatDate(adv.date)}{adv.reason ? ` — ${adv.reason}` : ''}
                </Text>
                <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600' }}>
                  {pesoFormat(adv.amount)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 10 }} />

      {/* Net pay */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Net Pay</Text>
        <Text style={{ color: '#C8A84B', fontSize: 18, fontWeight: '800' }}>{pesoFormat(netPay)}</Text>
      </View>

      {/* Paid badge */}
      {paidAt ? (
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#22C55E22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#22C55E44' }}>
            <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>PAID ✓</Text>
          </View>
          <Text style={{ color: '#606060', fontSize: 11, marginLeft: 8 }}>
            {formatDate(paidAt)}
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      <Divider />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#404040', fontSize: 10 }}>Generated: {generatedDate}</Text>
        <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>TIKNOK</Text>
      </View>
    </View>
  )
})

WorkerPayslipCard.displayName = 'WorkerPayslipCard'
export default WorkerPayslipCard
