import { forwardRef } from 'react'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
  }
  month: number
  year: number
  advances: PayslipAdvance[]
  netPay: number
  paidAt: string | null
}

const WorkerPayslipCard = forwardRef<HTMLDivElement, WorkerPayslipProps>((props, ref) => {
  const { farmName, ownerName, worker, month, year, advances, netPay, paidAt } = props
  const displayFarm  = farmName.trim()  || 'TIKNOK'
  const displayOwner = ownerName.trim()
  const totalAdvances   = advances.reduce((s, a) => s + a.amount, 0)
  const generatedDate   = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div
      ref={ref}
      style={{
        width: 720,
        backgroundColor: '#0A0A0A',
        padding: 40,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'absolute',
        left: -9999,
        top: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Farm header */}
      <p style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        {displayFarm}
      </p>
      {displayOwner && <p style={{ color: '#A0A0A0', fontSize: 14, marginBottom: 4 }}>{displayOwner}</p>}
      <p style={{ color: '#C8A84B', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
        Pay Slip
      </p>
      <p style={{ color: '#606060', fontSize: 12 }}>{generatedDate}</p>

      <div style={{ height: 1, backgroundColor: '#2A2A2A', margin: '20px 0' }} />

      {/* Worker profile */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        {worker.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={worker.photo}
            alt=""
            crossOrigin="anonymous"
            style={{ width: 70, height: 70, borderRadius: 35, marginRight: 16, objectFit: 'cover', backgroundColor: '#1E1E1E' }}
          />
        ) : (
          <div style={{
            width: 70, height: 70, borderRadius: 35, marginRight: 16,
            backgroundColor: '#1E1E1E', border: '1px solid #2A2A2A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30,
          }}>
            👷
          </div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{worker.name}</p>
          <p style={{ color: '#C8A84B', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{worker.position}</p>
          <p style={{ color: '#606060', fontSize: 12 }}>Every {getOrdinal(worker.salaryDay)} of the month</p>
          {worker.address    && <p style={{ color: '#A0A0A0', fontSize: 12, marginTop: 2 }}>📍 {worker.address}</p>}
          {worker.phoneNumber && <p style={{ color: '#A0A0A0', fontSize: 12, marginTop: 2 }}>📞 {worker.phoneNumber}</p>}
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: '#2A2A2A', margin: '16px 0' }} />

      {/* Salary breakdown */}
      <p style={{ color: '#C8A84B', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
        Salary Breakdown
      </p>
      <p style={{ color: '#606060', fontSize: 12, marginBottom: 12 }}>
        {MONTH_NAMES[month - 1]} {year}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
        <span style={{ color: '#A0A0A0', fontSize: 14 }}>Gross Salary</span>
        <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>{pesoFormat(worker.monthlySalary)}</span>
      </div>

      {totalAdvances > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: '#A0A0A0', fontSize: 14 }}>Total Advances</span>
            <span style={{ color: '#EF4444', fontSize: 14, fontWeight: 600 }}>- {pesoFormat(totalAdvances)}</span>
          </div>
          <div style={{ paddingLeft: 16, marginBottom: 4 }}>
            {advances.map(adv => (
              <div key={adv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#606060', fontSize: 12, flex: 1, marginRight: 8 }}>
                  {formatDate(adv.date)}{adv.reason ? ` — ${adv.reason}` : ''}
                </span>
                <span style={{ color: '#EF4444', fontSize: 12, fontWeight: 600 }}>{pesoFormat(adv.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 1, backgroundColor: '#2A2A2A', margin: '12px 0' }} />

      {/* Net pay */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
        <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 800 }}>Net Pay</span>
        <span style={{ color: '#C8A84B', fontSize: 22, fontWeight: 800 }}>{pesoFormat(netPay)}</span>
      </div>

      {/* Paid badge */}
      {paidAt && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            backgroundColor: '#22C55E22', borderRadius: 999, padding: '4px 14px',
            border: '1px solid #22C55E44',
          }}>
            <span style={{ color: '#22C55E', fontSize: 12, fontWeight: 700 }}>PAID ✓</span>
          </div>
          <span style={{ color: '#606060', fontSize: 12 }}>{formatDate(paidAt)}</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ height: 1, backgroundColor: '#2A2A2A', margin: '20px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#404040', fontSize: 10 }}>Generated: {generatedDate}</span>
        <span style={{ color: '#C8A84B', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>TIKNOK</span>
      </div>
    </div>
  )
})

WorkerPayslipCard.displayName = 'WorkerPayslipCard'
export default WorkerPayslipCard
