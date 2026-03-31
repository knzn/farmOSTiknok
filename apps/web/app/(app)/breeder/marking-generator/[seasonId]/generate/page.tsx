'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type HenAssignment = { henName: string; marking: string }

type Assignment = {
  matingId: string
  maleName: string
  noseGroup: string
  hens: HenAssignment[]
}

type MatingRow = {
  _id: string
  maleName: string
  sameMarking: boolean | null
  hens: { henName: string; previousMarking: string | null }[]
  override: string | null
}

// ─── Marking Picker ──────────────────────────────────────────────────────────

type NoseMark = 'LN' | 'RN' | 'DN'
type FeetMark = 'LO' | 'RO' | 'LI' | 'RI' | 'DL' | 'DR' | 'OO' | 'II'

const NOSE_OPTIONS: NoseMark[] = ['LN', 'RN', 'DN']
const FEET_OPTIONS: FeetMark[] = ['LO', 'RO', 'LI', 'RI', 'DL', 'DR', 'OO', 'II']

const CONFLICTS: Record<FeetMark, FeetMark[]> = {
  LO: ['DL', 'OO'],
  LI: ['DL', 'II'],
  RO: ['DR', 'OO'],
  RI: ['DR', 'II'],
  DL: ['LO', 'LI', 'OO', 'II'],
  DR: ['RO', 'RI', 'OO', 'II'],
  OO: ['LO', 'RO', 'DL', 'DR'],
  II: ['LI', 'RI', 'DL', 'DR'],
}

function buildMarking(nose: NoseMark | null, feet: FeetMark[]): string | null {
  if (!feet.length && !nose) return null
  const sorted = [...feet].sort((a, b) => FEET_OPTIONS.indexOf(a) - FEET_OPTIONS.indexOf(b))
  const parts = nose ? [nose, ...sorted] : sorted
  return parts.join('-')
}

function parseMarking(marking: string | null): { nose: NoseMark | null; feet: FeetMark[] } {
  if (!marking) return { nose: null, feet: [] }
  const parts = marking.split('-')
  let nose: NoseMark | null = null
  const feet: FeetMark[] = []
  for (const p of parts) {
    if (p === 'LN' || p === 'RN' || p === 'DN') nose = p as NoseMark
    else if (FEET_OPTIONS.includes(p as FeetMark)) feet.push(p as FeetMark)
  }
  return { nose, feet }
}

function MarkingPicker({ value, onChange }: { value: string | null; onChange: (m: string | null) => void }) {
  const parsed = parseMarking(value)
  const [nose, setNose] = useState(parsed.nose as NoseMark | null)
  const [feet, setFeet] = useState(parsed.feet as FeetMark[])

  function selectNose(n: NoseMark | null) { setNose(n); onChange(buildMarking(n, feet)) }

  function toggleFeet(mark: FeetMark) {
    const isSelected = feet.includes(mark)
    const conflicts = CONFLICTS[mark] ?? []
    const newFeet = isSelected ? feet.filter(f => f !== mark) : [...feet.filter(f => !conflicts.includes(f)), mark]
    setFeet(newFeet); onChange(buildMarking(nose, newFeet))
  }

  function isDisabled(mark: FeetMark) {
    return !feet.includes(mark) && feet.some(f => CONFLICTS[f]?.includes(mark))
  }

  const preview = buildMarking(nose, feet)

  return (
    <div>
      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Nose (optional)</p>
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => selectNose(null)} className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${nose === null ? 'bg-accent border-accent text-canvas' : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'}`}>None</button>
        {NOSE_OPTIONS.map(n => (
          <button key={n} onClick={() => selectNose(nose === n ? null : n)} className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${nose === n ? 'bg-accent border-accent text-canvas' : 'bg-canvas border-rim text-ink hover:border-accent/40'}`}>{n}</button>
        ))}
      </div>

      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Feet {nose ? '(optional)' : '(required)'}</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {FEET_OPTIONS.map(f => {
          const selected = feet.includes(f)
          const disabled = isDisabled(f)
          return (
            <button key={f} onClick={() => !disabled && toggleFeet(f)} disabled={disabled}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${selected ? 'bg-accent border-accent text-canvas' : disabled ? 'opacity-30 bg-canvas border-rim text-ink-3 cursor-not-allowed' : 'bg-canvas border-rim text-ink hover:border-accent/40'}`}>
              {f}
            </button>
          )
        })}
      </div>

      <div className="bg-canvas border border-rim rounded-xl px-4 py-3 text-center">
        <p className="text-ink-3 text-xs mb-1">Preview</p>
        <p className="text-accent text-2xl font-bold">{preview ?? '—'}</p>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GenerateMarkingsPage() {
  const params   = useParams()
  const seasonId = params.seasonId as string
  const router   = useRouter()

  const [screen, setScreen]       = useState('prereview' as 'prereview' | 'review')
  const [matingRows, setMatingRows] = useState([] as MatingRow[])
  const [preview, setPreview]     = useState([] as Assignment[])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError]         = useState('')
  const [expandedOverride, setExpandedOverride] = useState(null as string | null)

  // Swap modal
  const [swapTarget, setSwapTarget]   = useState(null as { matingId: string; henName: string; henIdx: number } | null)
  const [swapMarking, setSwapMarking] = useState(null as string | null)

  // previousMarkings: matingId → { henName: previousMarking }
  const [prevMap, setPrevMap] = useState({} as Record<string, Record<string, string>>)
  const hasPreviousMarkings   = Object.keys(prevMap).length > 0

  const load = useCallback(async () => {
    try {
      const matings = await apiRequest(`/seasons/${seasonId}/matings`) as MatingRow[]

      const newPrevMap: Record<string, Record<string, string>> = {}
      for (const m of matings) {
        const henMap: Record<string, string> = {}
        for (const h of m.hens) {
          if (h.previousMarking) henMap[h.henName] = h.previousMarking
        }
        if (Object.keys(henMap).length > 0) newPrevMap[m._id] = henMap
      }
      setPrevMap(newPrevMap)

      setMatingRows(matings.map(m => {
        let suggestedOverride: string | null = null
        if (m.sameMarking !== false && m.hens.length > 0) {
          const prevMarks = m.hens.map(h => h.previousMarking).filter(Boolean) as string[]
          const unique = Array.from(new Set(prevMarks))
          if (unique.length === 1 && prevMarks.length === m.hens.length) {
            suggestedOverride = unique[0]
          }
        }
        return { ...m, override: suggestedOverride }
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load matings')
    } finally {
      setLoading(false)
    }
  }, [seasonId])

  useEffect(() => { load() }, [load])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const overrides = matingRows
        .filter(r => r.override)
        .map(r => ({ matingId: r._id, marking: r.override! }))

      const data = await apiRequest(`/seasons/${seasonId}/generate`, {
        method: 'POST',
        body: { overrides },
      }) as { preview: Assignment[] }
      setPreview(data.preview)
      setScreen('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      await apiRequest(`/seasons/${seasonId}/generate/confirm`, {
        method: 'POST',
        body: {
          assignments: preview.map(a => ({
            matingId: a.matingId,
            noseGroup: a.noseGroup,
            hens: a.hens,
          })),
        },
      })
      router.push(`/breeder/marking-generator/${seasonId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save markings')
      setConfirming(false)
    }
  }

  function openSwap(matingId: string, henName: string, henIdx: number, currentMarking: string) {
    setSwapTarget({ matingId, henName, henIdx })
    setSwapMarking(currentMarking)
  }

  function applySwap() {
    if (!swapTarget || !swapMarking) return
    setPreview(prev => prev.map(a =>
      a.matingId === swapTarget.matingId
        ? { ...a, hens: a.hens.map((h, i) => i === swapTarget.henIdx ? { ...h, marking: swapMarking } : h) }
        : a
    ))
    setSwapTarget(null)
    setSwapMarking(null)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="h-4 w-32 bg-card rounded animate-pulse mb-6" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      {screen === 'prereview' ? (
        <>
          {/* Header */}
          <div className="mb-6">
            <Link href={`/breeder/marking-generator/${seasonId}`} className="text-accent text-sm hover:opacity-80">
              ‹ Back to Season
            </Link>
            <h1 className="text-ink text-2xl font-bold mt-1">Review Matings</h1>
            <p className="text-ink-2 text-sm mt-1">
              Optionally pre-assign a mandatory marking per mating, then generate.
            </p>
          </div>

          {/* Previous markings hint */}
          {hasPreviousMarkings && (
            <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-5 flex items-start gap-3">
              <span className="text-lg mt-0.5">💡</span>
              <div>
                <p className="text-accent text-sm font-bold mb-0.5">Previous season markings found</p>
                <p className="text-ink-2 text-xs leading-relaxed">
                  Same-marking matings have been pre-filled with last season's markings. You can clear or change them before generating.
                </p>
              </div>
            </div>
          )}

          {/* Mating rows */}
          <div className="flex flex-col gap-3 mb-6">
            {matingRows.map(row => (
              <div key={row._id} className="bg-card border border-rim rounded-xl overflow-hidden">
                {/* Row header */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-ink font-semibold truncate">{row.maleName}</p>
                    <p className="text-ink-2 text-xs mt-0.5">
                      {row.hens.length} hen{row.hens.length !== 1 ? 's' : ''}
                      {row.sameMarking !== null && (row.sameMarking ? ' · Same' : ' · Diff')}
                      {prevMap[row._id] && !row.override && (
                        <span className="text-accent"> · has prev marks</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {row.override && (
                      <span className="bg-accent/15 text-accent text-xs font-bold px-2.5 py-1 rounded-lg">
                        {row.override}
                      </span>
                    )}
                    <button
                      onClick={() => setExpandedOverride(expandedOverride === row._id ? null : row._id)}
                      className="text-ink-2 text-sm hover:text-ink transition-colors"
                    >
                      {expandedOverride === row._id ? 'Close ▲' : 'Set ▼'}
                    </button>
                  </div>
                </div>

                {/* Override picker */}
                {expandedOverride === row._id && (
                  <div className="px-4 pb-4 border-t border-rim">
                    <p className="text-ink-2 text-xs mt-3 mb-4">
                      Pre-assign marking (optional) · leave unset for auto-assign
                    </p>
                    <MarkingPicker
                      value={row.override}
                      onChange={m => setMatingRows(prev =>
                        prev.map(r => r._id === row._id ? { ...r, override: m } : r)
                      )}
                    />
                    {row.override && (
                      <button
                        onClick={() => {
                          setMatingRows(prev => prev.map(r => r._id === row._id ? { ...r, override: null } : r))
                          setExpandedOverride(null)
                        }}
                        className="mt-3 text-danger text-sm hover:opacity-80 transition-opacity"
                      >
                        Clear override
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-danger text-sm mb-4">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={generating || matingRows.length === 0}
            className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
          >
            {generating ? 'Generating…' : 'Generate Markings'}
          </button>
        </>
      ) : (
        <>
          {/* Header */}
          <div className="mb-6">
            <button onClick={() => setScreen('prereview')} className="text-accent text-sm hover:opacity-80">
              ‹ Back
            </button>
            <h1 className="text-ink text-2xl font-bold mt-1">Review Assignments</h1>
            <p className="text-ink-2 text-sm mt-1">
              Click <strong className="text-ink">swap</strong> to change any marking before saving.
            </p>
          </div>

          {/* Assignments */}
          <div className="flex flex-col gap-3 mb-4">
            {preview.map(a => (
              <div key={a.matingId} className="bg-card border border-rim rounded-xl overflow-hidden">
                {/* Male header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-rim">
                  <p className="text-ink font-semibold">{a.maleName}</p>
                  <span className="bg-accent/15 text-accent text-sm font-bold px-3 py-1 rounded-lg">
                    {a.noseGroup}
                  </span>
                </div>

                {/* Hen rows */}
                {a.hens.map((hen, hIdx) => {
                  const prev = prevMap[a.matingId]?.[hen.henName]
                  return (
                    <div key={hIdx} className="px-4 py-2.5 flex items-center justify-between border-b border-rim last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-ink-2 text-sm">{hen.henName}</p>
                        {prev && prev !== hen.marking && (
                          <p className="text-ink-3 text-xs mt-0.5">prev: {prev}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <span className="text-accent font-bold text-base">{hen.marking}</span>
                        <button
                          onClick={() => openSwap(a.matingId, hen.henName, hIdx, hen.marking)}
                          className="bg-canvas border border-rim rounded-lg px-2.5 py-1 text-ink-2 text-xs hover:border-accent/40 transition-colors"
                        >
                          swap
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {error && <p className="text-danger text-sm mb-4">{error}</p>}

          <p className="text-ink-3 text-xs text-center mb-3">
            Locks markings for this season. You can still edit matings after.
          </p>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 transition-opacity disabled:opacity-60"
          >
            {confirming ? 'Saving…' : 'Save & Confirm'}
          </button>
        </>
      )}

      {/* Swap modal */}
      {swapTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-md border border-rim">
            <div className="flex items-center justify-between p-5 border-b border-rim">
              <div>
                <h2 className="text-ink font-bold text-lg">Swap Marking</h2>
                <p className="text-ink-2 text-sm">Hen: {swapTarget.henName}</p>
              </div>
              <button
                onClick={() => { setSwapTarget(null); setSwapMarking(null) }}
                className="text-ink-3 hover:text-ink text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              <MarkingPicker value={swapMarking} onChange={setSwapMarking} />
              <button
                onClick={applySwap}
                disabled={!swapMarking}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 mt-4 transition-opacity disabled:opacity-60"
              >
                Apply Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
