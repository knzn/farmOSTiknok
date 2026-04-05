'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import WorkerPayslipCard from '@/components/WorkerPayslipCard'
import { downloadAsPng } from '@/lib/downloadPng'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pesoFormat(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function getPeriodDates(endMonth: number, endYear: number, salaryDay: number) {
  const startMonth = endMonth === 1 ? 12 : endMonth - 1
  const startYear  = endMonth === 1 ? endYear - 1 : endYear
  const daysInEnd  = new Date(endYear, endMonth, 0).getDate()
  const actualEnd  = Math.min(salaryDay, daysInEnd)
  const startDate  = new Date(startYear, startMonth - 1, salaryDay + 1, 0, 0, 0)
  const endDate    = new Date(endYear, endMonth - 1, actualEnd, 23, 59, 59)
  return { startDate, endDate, startMonth, startYear }
}

function getCurrentPeriodEnd(salaryDay: number, today: Date) {
  const day   = today.getDate()
  const month = today.getMonth() + 1
  const year  = today.getFullYear()
  if (day <= salaryDay) return { endMonth: month, endYear: year }
  return {
    endMonth: month === 12 ? 1 : month + 1,
    endYear:  month === 12 ? year + 1 : year,
  }
}

function advancesForPeriod(worker: Worker, endMonth: number, endYear: number) {
  const { startDate, endDate } = getPeriodDates(endMonth, endYear, worker.salaryDay ?? 30)
  return worker.advances.filter(a => {
    const d = new Date(a.date)
    return d >= startDate && d <= endDate
  })
}

function isMonthPaid(worker: Worker, month: number, year: number) {
  return worker.payments.some(p => p.month === month && p.year === year)
}

function paymentForMonth(worker: Worker, month: number, year: number) {
  return worker.payments.find(p => p.month === month && p.year === year) ?? null
}

function periodLabel(endMonth: number, endYear: number, salaryDay: number) {
  const { startDate, endDate } = getPeriodDates(endMonth, endYear, salaryDay)
  const fmt    = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  const endFmt = endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(startDate)} – ${endFmt}`
}

function getHistoryPeriods(worker: Worker) {
  // Collect all unique (month, year) pairs from advances + payments, then sort descending
  const seen = new Set<string>()
  const pairs: { month: number; year: number }[] = []
  for (const a of worker.advances) {
    const key = `${a.year}-${a.month}`
    if (!seen.has(key)) { seen.add(key); pairs.push({ month: a.month, year: a.year }) }
  }
  for (const p of worker.payments) {
    const key = `${p.year}-${p.month}`
    if (!seen.has(key)) { seen.add(key); pairs.push({ month: p.month, year: p.year }) }
  }
  return pairs.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkerDetailPage() {
  const params   = useParams()
  const workerId = params.workerId as string
  const router   = useRouter()

  const now = new Date()

  const [worker, setWorker]   = useState(null as Worker | null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [viewEndMonth, setViewEndMonth] = useState(now.getMonth() + 1)
  const [viewEndYear, setViewEndYear]   = useState(now.getFullYear())

  // Add advance
  const [showAdvance, setShowAdvance]   = useState(false)
  const [advAmount, setAdvAmount]       = useState('')
  const [advReason, setAdvReason]       = useState('')
  const [advDate, setAdvDate]           = useState(() => now.toISOString().split('T')[0])
  const [addingAdv, setAddingAdv]       = useState(false)
  const [advError, setAdvError]         = useState('')

  // Delete advance
  const [deletingAdvId, setDeletingAdvId] = useState(null as string | null)

  // Mark as paid
  const [payingMonth, setPayingMonth] = useState(false)
  const [payError, setPayError]       = useState('')

  // Edit worker
  const [showEdit, setShowEdit]           = useState(false)
  const [editName, setEditName]           = useState('')
  const [editPosition, setEditPosition]   = useState('')
  const [editCustomPos, setEditCustomPos] = useState('')
  const [editShowCustom, setEditShowCustom] = useState(false)
  const [editSalary, setEditSalary]       = useState('')
  const [editSalaryDay, setEditSalaryDay] = useState('')
  const [editAddress, setEditAddress]     = useState('')
  const [editPhone, setEditPhone]         = useState('')
  const [saving, setSaving]               = useState(false)
  const [saveError, setSaveError]         = useState('')

  // Delete worker
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  // History expand
  const [expandedPeriod, setExpandedPeriod] = useState(null as string | null)

  // Payslip export
  const payslipCardRef   = useRef<HTMLDivElement>(null)
  const [showPayslipModal, setShowPayslipModal] = useState(false)
  const [payslipFarmName, setPayslipFarmName]   = useState('')
  const [payslipOwnerName, setPayslipOwnerName] = useState('')
  const [exporting, setExporting]               = useState(false)

  async function handleDownloadPayslip() {
    if (!payslipCardRef.current || !worker) return
    setExporting(true)
    try {
      await downloadAsPng(
        payslipCardRef.current,
        `tiknok-payslip-${worker.name.replace(/\s+/g, '-')}-${MONTH_NAMES[viewEndMonth - 1]}-${viewEndYear}.png`,
      )
    } finally {
      setExporting(false)
    }
  }

  const load = useCallback(async () => {
    try {
      setError('')
      const data = await apiRequest(`/workers/${workerId}`) as Worker
      setWorker(data)
      const { endMonth, endYear } = getCurrentPeriodEnd(data.salaryDay ?? 30, now)
      setViewEndMonth(endMonth)
      setViewEndYear(endYear)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load worker')
    } finally {
      setLoading(false)
    }
  }, [workerId])

  useEffect(() => { load() }, [load])

  function openEdit() {
    if (!worker) return
    setEditName(worker.name)
    const isPreset = POSITION_PRESETS.includes(worker.position)
    setEditPosition(isPreset ? worker.position : '')
    setEditCustomPos(isPreset ? '' : worker.position)
    setEditShowCustom(!isPreset)
    setEditSalary(String(worker.monthlySalary))
    setEditSalaryDay(String(worker.salaryDay ?? 30))
    setEditAddress(worker.address ?? '')
    setEditPhone(worker.phoneNumber ?? '')
    setSaveError('')
    setShowEdit(true)
  }

  async function handleSaveEdit() {
    if (!worker) return
    const finalPos = editShowCustom ? editCustomPos.trim() : editPosition
    if (!editName.trim())  return setSaveError('Enter worker name')
    if (!finalPos)         return setSaveError('Select a position')
    const monthlySalary = parseFloat(editSalary.replace(/,/g, ''))
    if (isNaN(monthlySalary) || monthlySalary < 0) return setSaveError('Enter a valid salary')
    const day = parseInt(editSalaryDay, 10)
    const finalDay = isNaN(day) || day < 1 || day > 31 ? 30 : day

    setSaving(true)
    setSaveError('')
    try {
      const updated = await apiRequest(`/workers/${workerId}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          position: finalPos,
          monthlySalary,
          salaryDay: finalDay,
          address: editAddress.trim() || null,
          phoneNumber: editPhone.trim() || null,
        },
      }) as Worker
      setWorker(updated)
      setShowEdit(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddAdvance() {
    if (!worker) return
    const amount = parseFloat(advAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) return setAdvError('Enter a valid amount')
    const d = new Date(advDate)
    if (isNaN(d.getTime())) return setAdvError('Enter a valid date')

    setAddingAdv(true)
    setAdvError('')
    try {
      const updated = await apiRequest(`/workers/${workerId}/advances`, {
        method: 'POST',
        body: {
          amount,
          reason: advReason.trim() || null,
          date: advDate,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
        },
      }) as Worker
      setWorker(updated)
      setAdvAmount(''); setAdvReason(''); setAdvDate(now.toISOString().split('T')[0])
      setShowAdvance(false)
    } catch (e) {
      setAdvError(e instanceof Error ? e.message : 'Failed to add advance')
    } finally {
      setAddingAdv(false)
    }
  }

  async function handleDeleteAdvance(advanceId: string) {
    setDeletingAdvId(advanceId)
    try {
      const updated = await apiRequest(`/workers/${workerId}/advances/${advanceId}`, { method: 'DELETE' }) as Worker
      setWorker(updated)
    } catch {
      // ignore
    } finally {
      setDeletingAdvId(null)
    }
  }

  async function handleMarkPaid() {
    if (!worker) return
    setPayingMonth(true)
    setPayError('')
    try {
      const updated = await apiRequest(`/workers/${workerId}/pay`, {
        method: 'POST',
        body: { month: viewEndMonth, year: viewEndYear },
      }) as Worker
      setWorker(updated)
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Failed to mark as paid')
    } finally {
      setPayingMonth(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return setDeleteConfirm(true)
    setDeleting(true)
    try {
      await apiRequest(`/workers/${workerId}`, { method: 'DELETE' })
      router.push('/breeder/finance/workers')
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="h-4 w-32 bg-card rounded animate-pulse mb-6" />
        <div className="h-24 rounded-xl bg-card animate-pulse mb-3" />
        <div className="h-40 rounded-xl bg-card animate-pulse" />
      </div>
    )
  }

  if (error || !worker) {
    return (
      <div className="p-6 flex flex-col items-center py-16 gap-3">
        <p className="text-danger">{error || 'Worker not found'}</p>
        <button onClick={load} className="text-accent font-semibold">Retry</button>
      </div>
    )
  }

  const periodAdvances    = advancesForPeriod(worker, viewEndMonth, viewEndYear)
  const totalAdvances     = periodAdvances.reduce((s, a) => s + a.amount, 0)
  const netPay            = Math.max(0, worker.monthlySalary - totalAdvances)
  const paid              = isMonthPaid(worker, viewEndMonth, viewEndYear)
  const payment           = paymentForMonth(worker, viewEndMonth, viewEndYear)
  const label             = periodLabel(viewEndMonth, viewEndYear, worker.salaryDay ?? 30)
  const historyPeriods    = getHistoryPeriods(worker)
  const { endMonth: curEndMonth, endYear: curEndYear } = getCurrentPeriodEnd(worker.salaryDay ?? 30, now)
  const isCurrentPeriod   = viewEndMonth === curEndMonth && viewEndYear === curEndYear
  const isPayDay          = now.getDate() >= (worker.salaryDay ?? 30)

  return (
    <div className="p-6 max-w-2xl">
      {/* Nav */}
      <Link href="/breeder/finance/workers" className="text-accent text-sm hover:opacity-80">
        ‹ Workers
      </Link>

      {/* Worker card */}
      <div className="bg-card border border-rim rounded-xl p-5 mt-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-card-2 flex items-center justify-center text-2xl shrink-0">
            {worker.photo
              ? <img src={worker.photo} className="w-14 h-14 rounded-full object-cover" alt="" />
              : '👷'
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ink font-bold text-lg truncate">{worker.name}</p>
            <p className="text-ink-2 text-sm">{worker.position}</p>
          </div>
          <button
            onClick={openEdit}
            className="text-ink-2 hover:text-ink text-sm px-3 py-1.5 border border-rim rounded-lg transition-colors"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-canvas rounded-xl px-4 py-3">
            <p className="text-ink-3 text-xs mb-0.5">Monthly Salary</p>
            <p className="text-ink font-bold">{pesoFormat(worker.monthlySalary)}</p>
          </div>
          <div className="bg-canvas rounded-xl px-4 py-3">
            <p className="text-ink-3 text-xs mb-0.5">Pay Day</p>
            <p className="text-ink font-bold">
              {worker.salaryDay}{['th','st','nd','rd'][(worker.salaryDay % 10 > 3 || Math.floor(worker.salaryDay % 100 / 10) === 1) ? 0 : worker.salaryDay % 10] ?? 'th'} of month
            </p>
          </div>
        </div>

        {(worker.address || worker.phoneNumber) && (
          <div className="mt-3 flex flex-col gap-1">
            {worker.phoneNumber && <p className="text-ink-2 text-sm">📱 {worker.phoneNumber}</p>}
            {worker.address && <p className="text-ink-2 text-sm">📍 {worker.address}</p>}
          </div>
        )}
      </div>

      {/* Pay day banner */}
      {isCurrentPeriod && isPayDay && !paid && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-4 flex items-center gap-3">
          <span className="text-xl">💰</span>
          <p className="text-warning text-sm font-semibold flex-1">Pay day reached — mark as paid when settled</p>
        </div>
      )}

      {/* Current salary period */}
      <div className="bg-card border border-rim rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-rim">
          <div>
            <p className="text-ink font-bold">Salary Period</p>
            <p className="text-ink-3 text-xs mt-0.5">{label}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${paid ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent'}`}>
            {paid ? 'PAID' : 'UNPAID'}
          </span>
        </div>

        <div className="px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">Gross Salary</span>
            <span className="text-ink font-medium">{pesoFormat(worker.monthlySalary)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">Total Advances</span>
            <span className="text-danger font-medium">{totalAdvances > 0 ? `− ${pesoFormat(totalAdvances)}` : pesoFormat(0)}</span>
          </div>
          {totalAdvances > 0 && (
            <div className="border-t border-rim pt-1.5 flex justify-between text-sm font-bold">
              <span className="text-ink">Net Pay</span>
              <span className="text-accent">{pesoFormat(netPay)}</span>
            </div>
          )}
        </div>

        {/* Advances list */}
        {periodAdvances.length > 0 && (
          <div className="border-t border-rim">
            <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider px-4 pt-3 pb-2">Advances</p>
            {periodAdvances.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-t border-rim first:border-t-0">
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm font-medium">{pesoFormat(a.amount)}</p>
                  {a.reason && <p className="text-ink-3 text-xs">{a.reason}</p>}
                  <p className="text-ink-3 text-xs">{formatDate(a.date)}</p>
                </div>
                {!paid && (
                  <button
                    onClick={() => handleDeleteAdvance(a.id)}
                    disabled={deletingAdvId === a.id}
                    className="text-danger text-xs hover:opacity-70 transition-opacity ml-3 disabled:opacity-40"
                  >
                    {deletingAdvId === a.id ? '…' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {!paid && (
          <div className="p-4 border-t border-rim flex gap-3">
            <button
              onClick={() => { setAdvAmount(''); setAdvReason(''); setAdvDate(now.toISOString().split('T')[0]); setAdvError(''); setShowAdvance(true) }}
              className="flex-1 border border-rim rounded-xl py-2.5 text-ink-2 text-sm font-semibold hover:border-accent/40 transition-colors"
            >
              + Add Advance
            </button>
            <button
              onClick={handleMarkPaid}
              disabled={payingMonth}
              className="flex-1 bg-accent hover:opacity-90 text-canvas text-sm font-bold rounded-xl py-2.5 transition-opacity disabled:opacity-60"
            >
              {payingMonth ? 'Saving…' : 'Mark as Paid'}
            </button>
            <button
              onClick={() => setShowPayslipModal(true)}
              className="flex-1 border border-rim rounded-xl py-2.5 text-ink-2 text-sm font-semibold hover:border-accent/40 transition-colors"
            >
              ⬇ Payslip
            </button>
          </div>
        )}
        {paid && payment && (
          <div className="px-4 py-3 border-t border-rim flex items-center justify-between">
            <p className="text-success text-xs">✓ Paid on {formatDate(payment.paidAt)}</p>
            <button
              onClick={() => setShowPayslipModal(true)}
              className="text-accent text-xs font-semibold hover:opacity-80"
            >
              ⬇ Payslip
            </button>
          </div>
        )}
        {payError && <p className="text-danger text-xs px-4 pb-3">{payError}</p>}
      </div>

      {/* Salary history */}
      {historyPeriods.length > 0 && (
        <div className="mb-6">
          <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">History</p>
          <div className="flex flex-col gap-2">
            {historyPeriods.map(({ month, year }) => {
              const key = `${year}-${month}`
              const isOpen = expandedPeriod === key
              const pmt = paymentForMonth(worker, month, year)
              const periodLabel2 = `${MONTH_NAMES[month - 1]} ${year}`
              return (
                <div key={key} className="bg-card border border-rim rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedPeriod(isOpen ? null : key)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-canvas/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <p className="text-ink text-sm font-semibold">{periodLabel2}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pmt ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent'}`}>
                        {pmt ? 'PAID' : 'UNPAID'}
                      </span>
                    </div>
                    <span className="text-ink-3 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-rim px-4 py-3">
                      {pmt ? (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-ink-2">Gross Salary</span>
                            <span className="text-ink">{pesoFormat(pmt.grossSalary)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-2">Advances</span>
                            <span className="text-danger">{pmt.totalAdvances > 0 ? `− ${pesoFormat(pmt.totalAdvances)}` : pesoFormat(0)}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t border-rim pt-1.5">
                            <span className="text-ink">Net Pay</span>
                            <span className="text-accent">{pesoFormat(pmt.netPay)}</span>
                          </div>
                          <p className="text-ink-3 text-xs pt-1">Paid {formatDate(pmt.paidAt)}</p>
                        </div>
                      ) : (
                        <p className="text-ink-2 text-sm">No payment recorded</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="border-t border-rim pt-5">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
            deleteConfirm ? 'bg-danger/10 border border-danger text-danger' : 'text-danger hover:opacity-80'
          }`}
        >
          {deleting ? 'Deleting…' : deleteConfirm ? 'Tap again to confirm delete worker' : 'Delete Worker'}
        </button>
      </div>

      {/* Add Advance modal */}
      {showAdvance && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim">
            <div className="flex items-center justify-between p-5 border-b border-rim">
              <h2 className="text-ink font-bold text-lg">Add Advance</h2>
              <button onClick={() => setShowAdvance(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Amount (₱) *</label>
              <input
                type="number"
                value={advAmount}
                onChange={e => setAdvAmount(e.target.value)}
                placeholder="e.g. 500"
                autoFocus
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
              />

              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Date *</label>
              <input
                type="date"
                value={advDate}
                onChange={e => setAdvDate(e.target.value)}
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
              />

              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={advReason}
                onChange={e => setAdvReason(e.target.value)}
                placeholder="e.g. Medical, Allowance"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
              />

              {advError && <p className="text-danger text-sm mb-3">{advError}</p>}

              <button
                onClick={handleAddAdvance}
                disabled={addingAdv}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
              >
                {addingAdv ? 'Adding…' : 'Add Advance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Worker modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-rim shrink-0">
              <h2 className="text-ink font-bold text-lg">Edit Worker</h2>
              <button onClick={() => setShowEdit(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Name *</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
              />

              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Position *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {POSITION_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => { setEditPosition(p); setEditShowCustom(false) }}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                      editPosition === p && !editShowCustom
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => { setEditShowCustom(true); setEditPosition('') }}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                    editShowCustom
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'
                  }`}
                >
                  Custom
                </button>
              </div>
              {editShowCustom && (
                <input
                  type="text"
                  value={editCustomPos}
                  onChange={e => setEditCustomPos(e.target.value)}
                  placeholder="Custom position"
                  className="w-full bg-canvas border border-accent rounded-xl px-4 py-3 text-ink text-base outline-none mb-4"
                />
              )}

              <div className="mb-4" />

              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Monthly Salary (₱) *</label>
              <input
                type="number"
                value={editSalary}
                onChange={e => setEditSalary(e.target.value)}
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
              />

              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Pay Day *</label>
              <input
                type="number"
                value={editSalaryDay}
                onChange={e => setEditSalaryDay(e.target.value)}
                min="1"
                max="31"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
              />

              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Address</label>
              <input
                type="text"
                value={editAddress}
                onChange={e => setEditAddress(e.target.value)}
                placeholder="optional"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
              />

              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Phone Number</label>
              <input
                type="text"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                placeholder="optional"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-5"
              />

              {saveError && <p className="text-danger text-sm mb-3">{saveError}</p>}

              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payslip export modal */}
      {showPayslipModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim">
            <div className="flex items-center justify-between p-5 border-b border-rim">
              <h2 className="text-ink font-bold text-lg">Download Payslip</h2>
              <button onClick={() => setShowPayslipModal(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1">Farm Name</label>
                <input
                  value={payslipFarmName}
                  onChange={e => setPayslipFarmName(e.target.value)}
                  placeholder="Your farm name"
                  className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-sm outline-none focus:border-accent placeholder:text-ink-3"
                />
              </div>
              <div>
                <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1">Owner Name</label>
                <input
                  value={payslipOwnerName}
                  onChange={e => setPayslipOwnerName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-sm outline-none focus:border-accent placeholder:text-ink-3"
                />
              </div>
              <div className="bg-card border border-rim rounded-xl px-4 py-3">
                <p className="text-ink-2 text-sm">{worker.name} — {MONTH_NAMES[viewEndMonth - 1]} {viewEndYear}</p>
                <p className="text-accent text-sm font-bold mt-0.5">Net Pay: {pesoFormat(netPay)}</p>
              </div>
              <button
                onClick={() => { handleDownloadPayslip(); setShowPayslipModal(false) }}
                disabled={exporting}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
              >
                {exporting ? 'Generating…' : 'Download PNG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden payslip card — rendered off-screen for html2canvas */}
      <WorkerPayslipCard
        ref={payslipCardRef}
        farmName={payslipFarmName}
        ownerName={payslipOwnerName}
        worker={worker}
        month={viewEndMonth}
        year={viewEndYear}
        advances={periodAdvances}
        netPay={netPay}
        paidAt={payment?.paidAt ?? null}
      />
    </div>
  )
}
