'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

interface ActiveSeason {
  id: string
  name: string
  year: number
  markingsGenerated: boolean
  matingCount: number
  eggsLaid: number | null
  chicksHatched: number | null
  hatchRate: number | null
  expectedHatchDate: string | null
}

interface FinanceData {
  totalWorkers: number
  totalSalaryDue: number
  unpaidWorkers: number
  totalExpensesThisMonth: number
}

interface DashboardData {
  breeding: {
    totalSeasons: number
    activeSeason: ActiveSeason | null
    totalMatings: number
  }
  finance: FinanceData | null
}

function pesoFormat(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DashboardPage() {
  const router  = useRouter()
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await apiRequest<DashboardData>('/dashboard')
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="h-48 rounded-xl bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-ink-2">{error}</p>
        <button onClick={load} className="bg-accent/20 text-accent px-6 py-2 rounded-md font-semibold">
          Retry
        </button>
      </div>
    )
  }

  const { breeding, finance } = data ?? { breeding: { totalSeasons: 0, activeSeason: null, totalMatings: 0 }, finance: null }
  const { activeSeason } = breeding

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-ink text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Breeding card */}
        <button
          onClick={() => router.push('/breeder/marking-generator')}
          className="bg-card border border-rim rounded-xl p-5 text-left hover:border-accent/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌾</span>
              <span className="text-ink-2 text-xs font-semibold uppercase tracking-widest">Breeding Season</span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              activeSeason?.markingsGenerated
                ? 'bg-success/20 text-success'
                : activeSeason
                ? 'bg-accent/20 text-accent'
                : 'bg-rim text-ink-3'
            }`}>
              {activeSeason?.markingsGenerated ? 'Generated' : activeSeason ? 'Active' : 'No Season'}
            </span>
          </div>

          {activeSeason ? (
            <div>
              <p className="text-ink text-xl font-bold mb-3">{activeSeason.name} {activeSeason.year}</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-accent text-3xl font-black">{activeSeason.matingCount}</p>
                  <p className="text-ink-3 text-xs">Matings</p>
                </div>
                {activeSeason.chicksHatched != null && (
                  <div>
                    <p className="text-accent text-3xl font-black">{activeSeason.chicksHatched}</p>
                    <p className="text-ink-3 text-xs">Chicks</p>
                  </div>
                )}
                {activeSeason.hatchRate != null && (
                  <div>
                    <p className="text-success text-3xl font-black">{activeSeason.hatchRate}%</p>
                    <p className="text-ink-3 text-xs">Hatch Rate</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-ink text-xl font-bold mb-1">
                {breeding.totalSeasons} Season{breeding.totalSeasons !== 1 ? 's' : ''} · {breeding.totalMatings} Matings
              </p>
              <p className="text-ink-3 text-sm">No active season running</p>
            </div>
          )}
          <p className="text-accent text-xs font-bold mt-4">Open Breeding →</p>
        </button>

        {/* Finance card */}
        {finance && finance.totalWorkers > 0 && (
          <button
            onClick={() => router.push('/breeder/finance')}
            className={`bg-card border rounded-xl p-5 text-left hover:border-accent/40 transition-colors ${
              finance.unpaidWorkers > 0 ? 'border-warning/30' : 'border-rim'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">💼</span>
                <span className="text-ink-2 text-xs font-semibold uppercase tracking-widest">Farm Finance</span>
              </div>
              {finance.unpaidWorkers > 0 && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-warning/20 text-warning">
                  {finance.unpaidWorkers} Unpaid
                </span>
              )}
            </div>
            <p className={`text-3xl font-black mb-1 ${finance.unpaidWorkers > 0 ? 'text-warning' : 'text-ink'}`}>
              {pesoFormat(finance.totalSalaryDue)}
            </p>
            <p className="text-ink-3 text-sm">
              Total salary due · {finance.totalWorkers} worker{finance.totalWorkers !== 1 ? 's' : ''}
            </p>
            {finance.totalExpensesThisMonth > 0 && (
              <p className="text-ink-2 text-xs mt-2">
                + {pesoFormat(finance.totalExpensesThisMonth)} expenses this month
              </p>
            )}
            <p className="text-accent text-xs font-bold mt-4">Open Finance →</p>
          </button>
        )}
      </div>
    </div>
  )
}
