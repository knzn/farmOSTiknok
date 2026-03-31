'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

type Season = {
  _id: string
  name: string
  year: number
  markingsGenerated: boolean
  matingCount: number
  createdAt: string
}

type DuplicateResult = {
  season: Season
  matingsCopied: number
}

const SEASON_TYPES = ['Early Bird', 'Local', 'National', 'Late Born', 'Off Season', 'Others'] as const

const currentYear = new Date().getFullYear()

export default function MarkingGeneratorPage() {
  const router = useRouter()

  const [seasons, setSeasons]             = useState([] as Season[])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [expandedYears, setExpandedYears] = useState(() => new Set<number>([currentYear]))

  // Create modal
  const [showCreate, setShowCreate]     = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [customName, setCustomName]     = useState('')
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState('')

  // Options modal
  const [optionsSeason, setOptionsSeason] = useState(null as Season | null)
  const [duplicating, setDuplicating]     = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [optionsError, setOptionsError]   = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const data = await apiRequest('/seasons') as Season[]
      setSeasons(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function buildSeasonName(type: string, year: number): string {
    const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const existing = seasons.filter(s =>
      s.year === year && (s.name === type || new RegExp(`^${escaped} \\d+$`).test(s.name))
    )
    return existing.length === 0 ? type : `${type} ${existing.length + 1}`
  }

  async function handleCreate() {
    if (!selectedType) return setCreateError('Select a season type')
    const name = selectedType === 'Others' ? customName.trim() : buildSeasonName(selectedType, currentYear)
    if (!name) return setCreateError('Enter a season name')
    setCreating(true)
    setCreateError('')
    try {
      const season = await apiRequest('/seasons', { method: 'POST', body: { name, year: currentYear } }) as Season
      setSeasons(prev => [season, ...prev])
      setShowCreate(false)
      router.push(`/breeder/marking-generator/${season._id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  async function handleDuplicate() {
    if (!optionsSeason) return
    setDuplicating(true)
    setOptionsError('')
    try {
      const result = await apiRequest(`/seasons/${optionsSeason._id}/duplicate`, { method: 'POST' }) as DuplicateResult
      setSeasons(prev => [result.season, ...prev])
      setExpandedYears(prev => new Set<number>(Array.from(prev).concat(currentYear)))
      setOptionsSeason(null)
      router.push(`/breeder/marking-generator/${result.season._id}`)
    } catch (e) {
      setOptionsError(e instanceof Error ? e.message : 'Failed to duplicate')
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDelete() {
    if (!optionsSeason) return
    if (!deleteConfirm) return setDeleteConfirm(true)
    setDeleting(true)
    setOptionsError('')
    try {
      await apiRequest(`/seasons/${optionsSeason._id}`, { method: 'DELETE' })
      setSeasons(prev => prev.filter(s => s._id !== optionsSeason._id))
      setOptionsSeason(null)
    } catch (e) {
      setOptionsError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  // Group by year
  const byYear: Record<number, Season[]> = {}
  for (const s of seasons) {
    if (!byYear[s.year]) byYear[s.year] = []
    byYear[s.year].push(s)
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  // Proposed name preview
  const proposedName = selectedType && selectedType !== 'Others'
    ? buildSeasonName(selectedType, currentYear)
    : ''
  const showDupeWarning = proposedName && proposedName !== selectedType

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/breeder" className="text-accent text-sm hover:opacity-80">‹ Farm OS</Link>
          <h1 className="text-ink text-2xl font-bold mt-1">Breeding Records</h1>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelectedType(''); setCustomName(''); setCreateError('') }}
          className="bg-accent hover:opacity-90 text-canvas font-bold px-4 py-2 rounded-full text-sm transition-opacity"
        >
          + New Season
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <p className="text-danger">{error}</p>
          <button onClick={load} className="text-accent font-semibold">Retry</button>
        </div>
      ) : seasons.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-6xl mb-4">🐓</span>
          <h2 className="text-ink text-xl font-bold mb-2">Start Your First Season</h2>
          <p className="text-ink-2 text-sm max-w-xs leading-relaxed">
            Create a breeding season to manage matings, generate markings, and track egg and chick counts.
          </p>
        </div>
      ) : (
        <div>
          {years.map(year => {
            const isExpanded = expandedYears.has(year)
            const list = byYear[year]
            return (
              <div key={year} className="mb-2">
                <button
                  onClick={() => setExpandedYears(prev => {
                    const next = new Set<number>(prev)
                    if (next.has(year)) next.delete(year)
                    else next.add(year)
                    return next
                  })}
                  className="flex items-center gap-2 py-2 text-ink-3 text-xs font-bold uppercase tracking-widest hover:text-ink-2 transition-colors w-full text-left"
                >
                  <span>{year}</span>
                  {!isExpanded && <span>({list.length} season{list.length !== 1 ? 's' : ''})</span>}
                  <span>{isExpanded ? '▲' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div className="flex flex-col gap-2">
                    {list.map(s => (
                      <div key={s._id} className="bg-card border border-rim rounded-xl p-4 flex items-center hover:border-accent/30 transition-colors">
                        <Link href={`/breeder/marking-generator/${s._id}`} className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-ink font-semibold text-base truncate">{s.name}</p>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${s.markingsGenerated ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                              {s.markingsGenerated ? 'Generated' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-ink-2 text-sm">
                            {s.matingCount === 0 ? 'No matings yet' : `${s.matingCount} mating${s.matingCount !== 1 ? 's' : ''}`}
                          </p>
                        </Link>
                        <button
                          onClick={() => { setOptionsSeason(s); setDeleteConfirm(false); setOptionsError('') }}
                          className="ml-3 text-ink-3 hover:text-ink-2 px-2 py-1 text-xl leading-none"
                        >
                          ⋯
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim">
            <div className="flex items-center justify-between p-5 border-b border-rim">
              <h2 className="text-ink font-bold text-lg">New Breeding Season</h2>
              <button onClick={() => setShowCreate(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              <p className="text-ink-3 text-xs mb-4">A season = one breeding cycle or batch.</p>
              <div className="flex flex-col gap-2 mb-4">
                {SEASON_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`flex items-center px-4 py-3 rounded-xl border text-left transition-colors ${selectedType === type ? 'bg-accent/15 border-accent' : 'bg-canvas border-rim hover:border-accent/30'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center shrink-0 ${selectedType === type ? 'border-accent' : 'border-ink-3'}`}>
                      {selectedType === type && <div className="w-2 h-2 rounded-full bg-accent" />}
                    </div>
                    <span className={`text-base ${selectedType === type ? 'text-accent font-semibold' : 'text-ink'}`}>{type}</span>
                  </button>
                ))}
              </div>

              {selectedType === 'Others' && (
                <input
                  type="text"
                  placeholder="Season name"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  autoFocus
                  className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 mb-4"
                />
              )}

              {showDupeWarning && (
                <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2 mb-4">
                  <p className="text-accent text-sm">Already exists this year — will be created as <strong>{proposedName}</strong></p>
                </div>
              )}

              {createError && <p className="text-danger text-sm mb-3">{createError}</p>}

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
              >
                {creating ? 'Creating…' : 'Create Season'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Options modal */}
      {optionsSeason && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim">
            <div className="flex items-center justify-between p-5 border-b border-rim">
              <div>
                <h2 className="text-ink font-bold text-base">{optionsSeason.name}</h2>
                <p className="text-ink-3 text-sm">{optionsSeason.year} · {optionsSeason.matingCount} mating{optionsSeason.matingCount !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setOptionsSeason(null)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {optionsError && <p className="text-danger text-sm">{optionsError}</p>}

              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className="flex items-center gap-3 bg-canvas border border-rim rounded-xl px-4 py-3.5 hover:border-accent/30 transition-colors disabled:opacity-60 text-left"
              >
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-ink font-semibold text-base">{duplicating ? 'Duplicating…' : 'Duplicate Season'}</p>
                  <p className="text-ink-3 text-sm">Copy matings to a new {currentYear} season</p>
                </div>
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-colors disabled:opacity-60 text-left ${deleteConfirm ? 'bg-danger/10 border-danger' : 'bg-canvas border-rim hover:border-danger/40'}`}
              >
                <span className="text-xl">🗑️</span>
                <div>
                  <p className="text-danger font-semibold text-base">{deleting ? 'Deleting…' : deleteConfirm ? 'Tap again to confirm delete' : 'Delete Season'}</p>
                  {!deleteConfirm && <p className="text-ink-3 text-sm">Removes all matings and markings</p>}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
