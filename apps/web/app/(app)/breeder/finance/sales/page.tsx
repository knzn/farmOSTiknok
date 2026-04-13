'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentStatus = 'paid' | 'partial' | 'unpaid'

interface Sale {
  id: string
  description: string
  amount: number
  date: string
  month: number
  year: number
  paymentStatus: PaymentStatus
  notes: string | null
}

interface MonthlySummary {
  month: number
  year: number
  total: number
  paid: number
  partial: number
  unpaid: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_LABEL: Record<PaymentStatus, string> = {
  paid:    'Paid',
  partial: 'Partial',
  unpaid:  'Unpaid',
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  paid:    'bg-success/15 text-success',
  partial: 'bg-warning/15 text-warning',
  unpaid:  'bg-danger/15 text-danger',
}

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  description: string
  amount: string
  date: string
  paymentStatus: PaymentStatus
  notes: string
}

function emptyForm(): FormState {
  return {
    description:   '',
    amount:        '',
    date:          new Date().toISOString().split('T')[0],
    paymentStatus: 'paid',
    notes:         '',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear  = now.getFullYear()

  const [sales, setSales]           = useState<Sale[]>([])
  const [summary, setSummary]       = useState<MonthlySummary[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Sheet
  const [showSheet, setShowSheet]   = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [form, setForm]             = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')

  // Delete
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [deleting, setDeleting]     = useState(false)

  // History
  const [expandedMonth, setExpandedMonth]   = useState<string | null>(null)
  const [monthSales, setMonthSales]         = useState<Record<string, Sale[]>>({})
  const [loadingMonth, setLoadingMonth]     = useState<string | null>(null)

  const loadCurrent = useCallback(async () => {
    try {
      setError('')
      const data = await apiRequest(`/sales?month=${curMonth}&year=${curYear}`) as Sale[]
      setSales(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }, [curMonth, curYear])

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiRequest('/sales/summary') as { byMonth: MonthlySummary[] }
      setSummary(data.byMonth.filter(m => !(m.month === curMonth && m.year === curYear)))
    } catch {
      // non-critical
    }
  }, [curMonth, curYear])

  useEffect(() => {
    loadCurrent()
    loadSummary()
  }, [loadCurrent, loadSummary])

  async function loadMonthSales(month: number, year: number) {
    const key = `${year}-${month}`
    if (monthSales[key]) return
    setLoadingMonth(key)
    try {
      const data = await apiRequest(`/sales?month=${month}&year=${year}`) as Sale[]
      setMonthSales(prev => ({ ...prev, [key]: data }))
    } catch { /* ignore */ }
    finally { setLoadingMonth(null) }
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setFormError('')
    setShowSheet(true)
  }

  function openEdit(sale: Sale) {
    setEditingId(sale.id)
    setForm({
      description:   sale.description,
      amount:        String(sale.amount),
      date:          sale.date.split('T')[0],
      paymentStatus: sale.paymentStatus,
      notes:         sale.notes ?? '',
    })
    setFormError('')
    setShowSheet(true)
  }

  async function handleSubmit() {
    if (!form.description.trim()) return setFormError('Enter a description')
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt < 0) return setFormError('Enter a valid amount')

    const body = {
      description:   form.description.trim(),
      amount:        amt,
      date:          form.date,
      paymentStatus: form.paymentStatus,
      notes:         form.notes.trim() || null,
    }

    setSubmitting(true)
    setFormError('')
    try {
      if (editingId) {
        const updated = await apiRequest(`/sales/${editingId}`, { method: 'PATCH', body }) as Sale
        setSales(prev => prev.map(s => s.id === editingId ? updated : s))
        // Also update in history if loaded
        setMonthSales(prev => {
          const key = `${updated.year}-${updated.month}`
          if (!prev[key]) return prev
          return { ...prev, [key]: prev[key].map(s => s.id === editingId ? updated : s) }
        })
      } else {
        const created = await apiRequest('/sales', { method: 'POST', body }) as Sale
        if (created.month === curMonth && created.year === curYear) {
          setSales(prev => [created, ...prev])
        }
      }
      setShowSheet(false)
      loadSummary()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (deleteId !== id) return setDeleteId(id)
    setDeleting(true)
    try {
      await apiRequest(`/sales/${id}`, { method: 'DELETE' })
      setSales(prev => prev.filter(s => s.id !== id))
      setDeleteId(null)
      loadSummary()
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }

  const totalCurrentMonth = sales.reduce((s, e) => s + e.amount, 0)
  const totalUnpaid = sales
    .filter(s => s.paymentStatus !== 'paid')
    .reduce((s, e) => s + e.amount, 0)

  const historyByYear: Record<number, MonthlySummary[]> = {}
  for (const m of summary) {
    if (!historyByYear[m.year]) historyByYear[m.year] = []
    historyByYear[m.year].push(m)
  }
  const historyYears = Object.keys(historyByYear).map(Number).sort((a, b) => b - a)

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/breeder/finance" className="text-accent text-sm hover:opacity-80">‹ Farm Finance</Link>
          <h1 className="text-ink text-2xl font-bold mt-1">Farm Sales</h1>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent hover:opacity-90 text-canvas font-bold px-4 py-2 rounded-full text-sm transition-opacity"
        >
          + Add Sale
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <p className="text-danger">{error}</p>
          <button onClick={loadCurrent} className="text-accent font-semibold">Retry</button>
        </div>
      ) : (
        <>
          {/* Current month */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-ink font-bold text-lg">
                {MONTH_NAMES[curMonth - 1]} {curYear}
              </p>
              {totalCurrentMonth > 0 && (
                <div className="text-right">
                  <p className="text-success font-bold">{peso(totalCurrentMonth)}</p>
                  {totalUnpaid > 0 && (
                    <p className="text-danger text-xs">{peso(totalUnpaid)} outstanding</p>
                  )}
                </div>
              )}
            </div>

            {sales.length === 0 ? (
              <div className="bg-card border border-rim rounded-xl p-8 text-center">
                <span className="text-4xl block mb-3">💰</span>
                <p className="text-ink font-semibold mb-1">No sales this month</p>
                <p className="text-ink-2 text-sm">Record stag sales, bulk deals, and breeding fees.</p>
                <button
                  onClick={openCreate}
                  className="mt-4 border border-accent text-accent text-sm font-semibold px-5 py-2 rounded-full hover:bg-accent/10 transition-colors"
                >
                  Add First Sale
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sales.map(s => (
                  <div key={s.id} className="bg-card border border-rim rounded-xl p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-ink font-semibold text-sm">{s.description}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[s.paymentStatus]}`}>
                          {STATUS_LABEL[s.paymentStatus]}
                        </span>
                      </div>
                      <p className="text-ink-3 text-xs">
                        {new Date(s.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {s.notes ? ` · ${s.notes}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-success font-bold text-sm mb-2">{peso(s.amount)}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-ink-2 hover:text-ink text-xs px-2 py-1 border border-rim rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deleting && deleteId === s.id}
                          className={`text-xs px-2 py-1 border rounded-lg transition-colors ${
                            deleteId === s.id
                              ? 'border-danger text-danger bg-danger/10'
                              : 'border-rim text-danger hover:border-danger/40'
                          }`}
                        >
                          {deleting && deleteId === s.id ? '…' : deleteId === s.id ? 'Confirm' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          {summary.length > 0 && (
            <div>
              <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">History</p>
              {historyYears.map(year => (
                <div key={year} className="mb-2">
                  <p className="text-ink-3 text-xs font-bold uppercase tracking-widest py-2">{year}</p>
                  {historyByYear[year].map(m => {
                    const mkey = `${m.year}-${m.month}`
                    const isOpen = expandedMonth === mkey
                    return (
                      <div key={mkey} className="bg-card border border-rim rounded-xl overflow-hidden mb-2">
                        <button
                          onClick={async () => {
                            if (isOpen) { setExpandedMonth(null); return }
                            setExpandedMonth(mkey)
                            await loadMonthSales(m.month, m.year)
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-canvas/30 transition-colors"
                        >
                          <p className="text-ink text-sm font-semibold">{MONTH_NAMES[m.month - 1]} {m.year}</p>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-success font-bold text-sm">{peso(m.total)}</p>
                              {m.unpaid + m.partial > 0 && (
                                <p className="text-danger text-xs">{peso(m.unpaid + m.partial)} outstanding</p>
                              )}
                            </div>
                            <span className="text-ink-3 text-sm">{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-rim">
                            {loadingMonth === mkey ? (
                              <div className="px-4 py-4 flex justify-center">
                                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : (monthSales[mkey] ?? []).length === 0 ? (
                              <p className="px-4 py-3 text-ink-2 text-sm">No entries</p>
                            ) : (
                              <div>
                                {(monthSales[mkey] ?? []).map(s => (
                                  <div key={s.id} className="flex items-start px-4 py-3 border-t border-rim gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <p className="text-ink text-sm font-medium">{s.description}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[s.paymentStatus]}`}>
                                          {STATUS_LABEL[s.paymentStatus]}
                                        </span>
                                      </div>
                                      <p className="text-ink-3 text-xs">
                                        {new Date(s.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                        {s.notes ? ` · ${s.notes}` : ''}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-success font-bold text-sm mb-1">{peso(s.amount)}</p>
                                      <div className="flex gap-1">
                                        <button onClick={() => openEdit(s)} className="text-ink-2 hover:text-ink text-xs px-2 py-1 border border-rim rounded-lg transition-colors">Edit</button>
                                        <button
                                          onClick={() => handleDelete(s.id)}
                                          className={`text-xs px-2 py-1 border rounded-lg transition-colors ${deleteId === s.id ? 'border-danger text-danger bg-danger/10' : 'border-rim text-danger hover:border-danger/40'}`}
                                        >
                                          {deleteId === s.id ? 'Confirm' : 'Delete'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add / Edit sheet */}
      {showSheet && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-rim shrink-0">
              <h2 className="text-ink font-bold text-lg">
                {editingId ? 'Edit Sale' : 'Add Sale'}
              </h2>
              <button onClick={() => setShowSheet(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>

            <div className="p-5 overflow-y-auto">
              {/* Description */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Description *
              </label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Boss Dong - 20 stags, 30 pullets, 5 chicks"
                autoFocus
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
              />

              {/* Amount */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Amount (₱) *
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
              />

              {/* Payment Status */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">
                Payment Status
              </label>
              <div className="flex gap-2 mb-4">
                {(['paid', 'partial', 'unpaid'] as PaymentStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setForm(prev => ({ ...prev, paymentStatus: s }))}
                    className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                      form.paymentStatus === s
                        ? s === 'paid'
                          ? 'bg-success/15 border-success text-success'
                          : s === 'partial'
                          ? 'bg-warning/15 border-warning text-warning'
                          : 'bg-danger/15 border-danger text-danger'
                        : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>

              {/* Date */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
              />

              {/* Notes */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Notes (optional)
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g. Bloodline: Sweater, delivery via cargo"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-5"
              />

              {formError && <p className="text-danger text-sm mb-3">{formError}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
              >
                {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
