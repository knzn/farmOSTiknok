'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface MonthlySummary {
  month: number
  year: number
  total: number
  byCategory: Record<ExpenseCategory, number>
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const UNIT_OPTIONS: Record<ExpenseCategory, string[]> = {
  feeds:                ['Kilo', 'Sacks'],
  vitamins:             ['Kilo', 'Box', 'Sachet', '100mL', '10mL', 'Tablet/Capsule'],
  medicines:            ['Kilo', 'Box', 'Sachet', '100mL', '10mL', 'Tablet/Capsule'],
  deworming:            ['Kilo', 'Box', 'Sachet', '100mL', '10mL', 'Tablet/Capsule'],
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

function pesoFormat(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Expense Form ─────────────────────────────────────────────────────────────

interface FormState {
  category: ExpenseCategory | null
  name: string
  unit: string
  quantity: string
  price: string
  description: string
  amount: string
  date: string
  notes: string
}

function emptyForm(): FormState {
  return {
    category: null,
    name: '', unit: '', quantity: '', price: '',
    description: '', amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear  = now.getFullYear()

  const [expenses, setExpenses]       = useState([] as Expense[])
  const [summary, setSummary]         = useState([] as MonthlySummary[])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Add/Edit sheet
  const [showSheet, setShowSheet]     = useState(false)
  const [editingId, setEditingId]     = useState(null as string | null)
  const [formStep, setFormStep]       = useState(1) // 1 = category pick, 2 = fields
  const [form, setForm]               = useState(emptyForm)
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState('')

  // Delete confirm
  const [deleteId, setDeleteId]       = useState(null as string | null)
  const [deleting, setDeleting]       = useState(false)

  // History expand
  const [expandedMonth, setExpandedMonth]   = useState(null as string | null)
  const [monthExpenses, setMonthExpenses]   = useState({} as Record<string, Expense[]>)
  const [loadingMonth, setLoadingMonth]     = useState(null as string | null)

  const loadCurrent = useCallback(async () => {
    try {
      setError('')
      const data = await apiRequest(`/expenses?month=${curMonth}&year=${curYear}`) as Expense[]
      setExpenses(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [curMonth, curYear])

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiRequest('/expenses/summary') as { byMonth: MonthlySummary[] }
      // Exclude current month from history (shown above)
      setSummary(data.byMonth.filter(m => !(m.month === curMonth && m.year === curYear)))
    } catch {
      // summary non-critical
    }
  }, [curMonth, curYear])

  useEffect(() => {
    loadCurrent()
    loadSummary()
  }, [loadCurrent, loadSummary])

  async function loadMonthExpenses(month: number, year: number) {
    const key = `${year}-${month}`
    if (monthExpenses[key]) return
    setLoadingMonth(key)
    try {
      const data = await apiRequest(`/expenses?month=${month}&year=${year}`) as Expense[]
      setMonthExpenses(prev => ({ ...prev, [key]: data }))
    } catch {
      // ignore
    } finally {
      setLoadingMonth(null)
    }
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setFormStep(1)
    setFormError('')
    setShowSheet(true)
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id)
    setForm({
      category: expense.category,
      name: expense.name ?? '',
      unit: expense.unit ?? '',
      quantity: expense.quantity != null ? String(expense.quantity) : '',
      price: expense.pricePerUnit != null ? String(expense.pricePerUnit) : '',
      description: expense.description ?? '',
      amount: expense.amount != null ? String(expense.amount) : String(expense.totalAmount),
      date: expense.date.split('T')[0],
      notes: expense.notes ?? '',
    })
    setFormStep(2)
    setFormError('')
    setShowSheet(true)
  }

  async function handleSubmit() {
    if (!form.category) return setFormError('Select a category')
    const type = CATEGORY_TYPE[form.category]

    let body: Record<string, unknown> = {
      category: form.category,
      date: form.date,
      notes: form.notes.trim() || null,
    }

    if (type === 'unit') {
      if (!form.name.trim()) return setFormError('Enter product name')
      if (!form.unit) return setFormError('Select a unit')
      const qty = parseFloat(form.quantity)
      if (isNaN(qty) || qty <= 0) return setFormError('Enter a valid quantity')
      const price = parseFloat(form.price)
      if (isNaN(price) || price < 0) return setFormError('Enter a valid price')
      body = { ...body, name: form.name.trim(), unit: form.unit, quantity: qty, pricePerUnit: price }
    } else {
      const amt = parseFloat(form.amount)
      if (isNaN(amt) || amt < 0) return setFormError('Enter a valid amount')
      if (form.category === 'miscellaneous' && !form.description.trim()) return setFormError('Enter a description')
      body = {
        ...body,
        amount: amt,
        description: form.description.trim() || null,
      }
    }

    setSubmitting(true)
    setFormError('')
    try {
      if (editingId) {
        const updated = await apiRequest(`/expenses/${editingId}`, { method: 'PATCH', body }) as Expense
        setExpenses(prev => prev.map(e => e.id === editingId ? updated : e))
      } else {
        const created = await apiRequest('/expenses', { method: 'POST', body }) as Expense
        if (created.month === curMonth && created.year === curYear) {
          setExpenses(prev => [created, ...prev])
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
      await apiRequest(`/expenses/${id}`, { method: 'DELETE' })
      setExpenses(prev => prev.filter(e => e.id !== id))
      setDeleteId(null)
      loadSummary()
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  // Category totals for current month
  const categoryTotals: Record<string, number> = {}
  for (const e of expenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.totalAmount
  }
  const totalCurrentMonth = expenses.reduce((s, e) => s + e.totalAmount, 0)

  // Group current month expenses by category
  const byCategory: Record<string, Expense[]> = {}
  for (const e of expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = []
    byCategory[e.category].push(e)
  }

  // History grouped by year
  const historyByYear: Record<number, MonthlySummary[]> = {}
  for (const m of summary) {
    if (!historyByYear[m.year]) historyByYear[m.year] = []
    historyByYear[m.year].push(m)
  }
  const historyYears = Object.keys(historyByYear).map(Number).sort((a, b) => b - a)

  const unitTotal = form.category && CATEGORY_TYPE[form.category] === 'unit'
    ? parseFloat(form.quantity || '0') * parseFloat(form.price || '0')
    : 0

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/breeder/finance" className="text-accent text-sm hover:opacity-80">‹ Farm Finance</Link>
          <h1 className="text-ink text-2xl font-bold mt-1">Farm Expenses</h1>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent hover:opacity-90 text-canvas font-bold px-4 py-2 rounded-full text-sm transition-opacity"
        >
          + Add Expense
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
                <p className="text-accent font-bold">{pesoFormat(totalCurrentMonth)}</p>
              )}
            </div>

            {/* Category summary chips */}
            {totalCurrentMonth > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {ALL_CATEGORIES.filter(c => categoryTotals[c] > 0).map(c => (
                  <span key={c} className="bg-card border border-rim rounded-full px-3 py-1 text-xs">
                    <span className="mr-1">{CATEGORY_EMOJI[c]}</span>
                    <span className="text-ink-2">{CATEGORY_LABEL[c]}</span>
                    <span className="text-ink font-bold ml-1">{pesoFormat(categoryTotals[c])}</span>
                  </span>
                ))}
              </div>
            )}

            {expenses.length === 0 ? (
              <div className="bg-card border border-rim rounded-xl p-8 text-center">
                <span className="text-4xl block mb-3">💸</span>
                <p className="text-ink font-semibold mb-1">No expenses this month</p>
                <p className="text-ink-2 text-sm">Track feeds, medicines, and farm costs.</p>
                <button
                  onClick={openCreate}
                  className="mt-4 border border-accent text-accent text-sm font-semibold px-5 py-2 rounded-full hover:bg-accent/10 transition-colors"
                >
                  Add First Expense
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {ALL_CATEGORIES.filter(c => byCategory[c]?.length > 0).map(c => (
                  <div key={c} className="bg-card border border-rim rounded-xl overflow-hidden">
                    <div className="flex items-center px-4 py-2.5 bg-canvas/30">
                      <span className="text-base mr-2">{CATEGORY_EMOJI[c]}</span>
                      <span className="text-ink-2 text-xs font-semibold uppercase tracking-wider flex-1">{CATEGORY_LABEL[c]}</span>
                      <span className="text-ink text-sm font-bold">{pesoFormat(categoryTotals[c])}</span>
                    </div>
                    {byCategory[c].map(e => (
                      <div key={e.id} className="flex items-center px-4 py-2.5 border-t border-rim gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-ink text-sm font-medium truncate">
                            {e.name ?? e.description ?? CATEGORY_LABEL[e.category]}
                          </p>
                          <p className="text-ink-3 text-xs">
                            {e.unit && e.quantity != null ? `${e.quantity} ${e.unit} · ` : ''}
                            {new Date(e.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            {e.notes ? ' · has notes' : ''}
                            {e.receiptUrl ? ' 🧾' : ''}
                          </p>
                        </div>
                        <span className="text-accent font-bold text-sm shrink-0">{pesoFormat(e.totalAmount)}</span>
                        {e.locked ? (
                          <span className="text-ink-3 text-sm">🔒</span>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(e)}
                              className="text-ink-2 hover:text-ink text-xs px-2 py-1 border border-rim rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              disabled={deleting && deleteId === e.id}
                              className={`text-xs px-2 py-1 border rounded-lg transition-colors ${
                                deleteId === e.id
                                  ? 'border-danger text-danger bg-danger/10'
                                  : 'border-rim text-danger hover:border-danger/40'
                              }`}
                            >
                              {deleting && deleteId === e.id ? '…' : deleteId === e.id ? 'Confirm' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
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
                            await loadMonthExpenses(m.month, m.year)
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-canvas/30 transition-colors"
                        >
                          <p className="text-ink text-sm font-semibold">{MONTH_NAMES[m.month - 1]} {m.year}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-accent font-bold text-sm">{pesoFormat(m.total)}</span>
                            <span className="text-ink-3 text-sm">{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-rim">
                            {loadingMonth === mkey ? (
                              <div className="px-4 py-4 flex justify-center">
                                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : (monthExpenses[mkey] ?? []).length === 0 ? (
                              <p className="px-4 py-3 text-ink-2 text-sm">No entries</p>
                            ) : (
                              <div>
                                {/* Category chips */}
                                <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-rim">
                                  {ALL_CATEGORIES.filter(c => m.byCategory[c] > 0).map(c => (
                                    <span key={c} className="bg-canvas rounded-full px-3 py-1 text-xs">
                                      <span className="mr-1">{CATEGORY_EMOJI[c]}</span>
                                      <span className="text-ink-2">{CATEGORY_LABEL[c]}</span>
                                      <span className="text-ink font-bold ml-1">{pesoFormat(m.byCategory[c])}</span>
                                    </span>
                                  ))}
                                </div>
                                {/* Entries */}
                                {(monthExpenses[mkey] ?? []).map(e => (
                                  <div key={e.id} className="flex items-center px-4 py-2.5 border-t border-rim gap-3">
                                    <span className="text-base shrink-0">{CATEGORY_EMOJI[e.category]}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-ink text-sm font-medium truncate">
                                        {e.name ?? e.description ?? CATEGORY_LABEL[e.category]}
                                      </p>
                                      <p className="text-ink-3 text-xs">
                                        {e.unit && e.quantity != null ? `${e.quantity} ${e.unit} · ` : ''}
                                        {new Date(e.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                      </p>
                                    </div>
                                    <span className="text-accent font-bold text-sm shrink-0">{pesoFormat(e.totalAmount)}</span>
                                    {!e.locked && (
                                      <div className="flex gap-1">
                                        <button onClick={() => openEdit(e)} className="text-ink-2 hover:text-ink text-xs px-2 py-1 border border-rim rounded-lg transition-colors">Edit</button>
                                        <button
                                          onClick={() => handleDelete(e.id)}
                                          className={`text-xs px-2 py-1 border rounded-lg transition-colors ${deleteId === e.id ? 'border-danger text-danger bg-danger/10' : 'border-rim text-danger hover:border-danger/40'}`}
                                        >
                                          {deleteId === e.id ? 'Confirm' : 'Delete'}
                                        </button>
                                      </div>
                                    )}
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
              <div className="flex items-center gap-3">
                {formStep === 2 && !editingId && (
                  <button onClick={() => setFormStep(1)} className="text-accent text-sm hover:opacity-80">‹</button>
                )}
                <h2 className="text-ink font-bold text-lg">
                  {editingId ? 'Edit Expense' : formStep === 1 ? 'Select Category' : `${CATEGORY_EMOJI[form.category!]} ${CATEGORY_LABEL[form.category!]}`}
                </h2>
              </div>
              <button onClick={() => setShowSheet(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>

            <div className="p-5 overflow-y-auto">
              {formStep === 1 ? (
                // Step 1 — category grid
                <div className="grid grid-cols-2 gap-3">
                  {ALL_CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => { setForm(prev => ({ ...prev, category: c })); setFormStep(2); setFormError('') }}
                      className="bg-canvas border border-rim rounded-xl p-4 flex flex-col items-center gap-2 hover:border-accent/40 transition-colors"
                    >
                      <span className="text-3xl">{CATEGORY_EMOJI[c]}</span>
                      <span className="text-ink text-sm font-semibold text-center">{CATEGORY_LABEL[c]}</span>
                    </button>
                  ))}
                </div>
              ) : form.category ? (
                // Step 2 — form fields
                <div>
                  {(() => {
                    const type = CATEGORY_TYPE[form.category]
                    return type === 'unit' ? (
                      <>
                        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Product Name *</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder={CATEGORY_PLACEHOLDER[form.category]}
                          autoFocus
                          className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
                        />

                        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Unit *</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {UNIT_OPTIONS[form.category].map(u => (
                            <button
                              key={u}
                              onClick={() => setForm(prev => ({ ...prev, unit: u }))}
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                form.unit === u
                                  ? 'bg-accent/15 border-accent text-accent'
                                  : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Quantity *</label>
                            <input
                              type="number"
                              value={form.quantity}
                              onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                              placeholder="0"
                              className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Price / Unit (₱) *</label>
                            <input
                              type="number"
                              value={form.price}
                              onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                              placeholder="0"
                              className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent"
                            />
                          </div>
                        </div>

                        {unitTotal > 0 && (
                          <div className="bg-canvas border border-rim rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
                            <span className="text-ink-2 text-sm">Total</span>
                            <span className="text-accent font-bold">{pesoFormat(unitTotal)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {form.category === 'miscellaneous' && (
                          <>
                            <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Description *</label>
                            <input
                              type="text"
                              value={form.description}
                              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                              placeholder={CATEGORY_PLACEHOLDER[form.category]}
                              autoFocus
                              className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
                            />
                          </>
                        )}
                        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Amount (₱) *</label>
                        <input
                          type="number"
                          value={form.amount}
                          onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="0"
                          autoFocus={form.category !== 'miscellaneous'}
                          className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
                        />
                      </>
                    )
                  })()}

                  {/* Date */}
                  <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent mb-4"
                  />

                  {/* Notes */}
                  <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Notes (optional)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. bulk buy, split cost"
                    className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-5"
                  />

                  {formError && <p className="text-danger text-sm mb-3">{formError}</p>}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
                  >
                    {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add Expense'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
