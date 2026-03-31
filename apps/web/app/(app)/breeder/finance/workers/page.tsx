'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

interface WorkerData {
  id: string
  name: string
  position: string
  monthlySalary: number
  salaryDay: number
  photo: string | null
  advances: { amount: number; month: number; year: number }[]
  payments: { month: number; year: number }[]
}

const POSITION_PRESETS = [
  'Farm Manager',
  'Handler',
  'Assistant Handler',
  'Breeder',
  'Assistant Breeder',
  'Farm Buddy',
]

function pesoFormat(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getCurrentMonthNetPay(w: WorkerData): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const advances = w.advances
    .filter(a => a.month === month && a.year === year)
    .reduce((s, a) => s + a.amount, 0)
  return Math.max(0, w.monthlySalary - advances)
}

function isCurrentMonthPaid(w: WorkerData): boolean {
  const now = new Date()
  return w.payments.some(p => p.month === now.getMonth() + 1 && p.year === now.getFullYear())
}

export default function WorkersPage() {
  const router = useRouter()

  const [workers, setWorkers] = useState([] as WorkerData[])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Create form
  const [showCreate, setShowCreate]   = useState(false)
  const [name, setName]               = useState('')
  const [position, setPosition]       = useState('')
  const [customPos, setCustomPos]     = useState('')
  const [showCustom, setShowCustom]   = useState(false)
  const [salary, setSalary]           = useState('')
  const [salaryDay, setSalaryDay]     = useState('30')
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const data = await apiRequest('/workers') as WorkerData[]
      setWorkers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setName(''); setPosition(''); setCustomPos(''); setSalary(''); setSalaryDay('30')
    setShowCustom(false); setCreateError('')
  }

  async function handleCreate() {
    const finalPos = showCustom ? customPos.trim() : position
    if (!name.trim())  return setCreateError('Enter worker name')
    if (!finalPos)     return setCreateError('Select a position')
    const monthlySalary = parseFloat(salary.replace(/,/g, ''))
    if (isNaN(monthlySalary) || monthlySalary < 0) return setCreateError('Enter a valid salary')
    const day = parseInt(salaryDay, 10)
    const finalDay = isNaN(day) || day < 1 || day > 31 ? 30 : day

    setCreating(true)
    setCreateError('')
    try {
      const w = await apiRequest('/workers', {
        method: 'POST',
        body: { name: name.trim(), position: finalPos, monthlySalary, salaryDay: finalDay },
      }) as WorkerData
      setWorkers(prev => [w, ...prev])
      setShowCreate(false)
      resetForm()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/breeder/finance" className="text-accent text-sm hover:opacity-80">‹ Farm Finance</Link>
          <h1 className="text-ink text-2xl font-bold mt-1">Workers</h1>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true) }}
          className="bg-accent hover:opacity-90 text-canvas font-bold px-4 py-2 rounded-full text-sm transition-opacity"
        >
          + Add Worker
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <p className="text-danger">{error}</p>
          <button onClick={load} className="text-accent font-semibold">Retry</button>
        </div>
      ) : workers.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-6xl mb-4">👷</span>
          <h2 className="text-ink text-xl font-bold mb-2">No workers yet</h2>
          <p className="text-ink-2 text-sm max-w-xs leading-relaxed">
            Add your farm workers to track salary, advances, and monthly payroll.
          </p>
          <button
            onClick={() => { resetForm(); setShowCreate(true) }}
            className="mt-5 border border-accent text-accent text-sm font-semibold px-5 py-2 rounded-full hover:bg-accent/10 transition-colors"
          >
            Add First Worker
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {workers.map(w => {
            const paid   = isCurrentMonthPaid(w)
            const netPay = getCurrentMonthNetPay(w)
            return (
              <button
                key={w.id}
                onClick={() => router.push(`/breeder/finance/workers/${w.id}`)}
                className="bg-card border border-rim rounded-xl p-4 flex items-center hover:border-accent/30 transition-colors text-left w-full"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-card-2 flex items-center justify-center text-xl mr-3 shrink-0">
                  {w.photo
                    ? <img src={w.photo} className="w-11 h-11 rounded-full object-cover" alt="" />
                    : '👷'
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-semibold truncate">{w.name}</p>
                  <p className="text-ink-2 text-sm">{w.position}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-accent font-bold text-sm">{pesoFormat(netPay)}</p>
                  <span className={`inline-block mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${paid ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent'}`}>
                    {paid ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
                <span className="text-ink-3 ml-3 text-lg">›</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-rim shrink-0">
              <h2 className="text-ink font-bold text-lg">Add Worker</h2>
              <button onClick={() => setShowCreate(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="p-5 overflow-y-auto">
              {/* Name */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                autoFocus
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
              />

              {/* Position presets */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Position *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {POSITION_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => { setPosition(p); setShowCustom(false) }}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                      position === p && !showCustom
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => { setShowCustom(true); setPosition('') }}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                    showCustom
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'
                  }`}
                >
                  Custom
                </button>
              </div>
              {showCustom && (
                <input
                  type="text"
                  value={customPos}
                  onChange={e => setCustomPos(e.target.value)}
                  placeholder="Enter custom position"
                  autoFocus
                  className="w-full bg-canvas border border-accent rounded-xl px-4 py-3 text-ink text-base outline-none placeholder:text-ink-3 mb-4"
                />
              )}

              <div className="mb-4" />

              {/* Salary */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Monthly Salary (₱) *</label>
              <input
                type="number"
                value={salary}
                onChange={e => setSalary(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
              />

              {/* Pay day */}
              <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1">Pay Day *</label>
              <p className="text-ink-3 text-xs mb-1.5">Which day of the month is salary due? (e.g. 30)</p>
              <input
                type="number"
                value={salaryDay}
                onChange={e => setSalaryDay(e.target.value)}
                placeholder="30"
                min="1"
                max="31"
                className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-5"
              />

              {createError && <p className="text-danger text-sm mb-3">{createError}</p>}

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
              >
                {creating ? 'Adding…' : 'Add Worker'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
