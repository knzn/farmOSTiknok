'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { apiRequest } from '@/lib/api'

// ─── Marking Picker (inline) ─────────────────────────────────────────────────

type NoseMark = 'LN' | 'RN' | 'DN'
type FeetMark = 'LO' | 'RO' | 'LI' | 'RI' | 'DL' | 'DR' | 'OO' | 'II'
const NOSE_OPTIONS: NoseMark[] = ['LN', 'RN', 'DN']
const FEET_OPTIONS: FeetMark[] = ['LO', 'RO', 'LI', 'RI', 'DL', 'DR', 'OO', 'II']
const CONFLICTS: Record<FeetMark, FeetMark[]> = {
  LO: ['DL', 'OO'], LI: ['DL', 'II'], RO: ['DR', 'OO'], RI: ['DR', 'II'],
  DL: ['LO', 'LI', 'OO', 'II'], DR: ['RO', 'RI', 'OO', 'II'],
  OO: ['LO', 'RO', 'DL', 'DR'], II: ['LI', 'RI', 'DL', 'DR'],
}
function buildMarking(nose: NoseMark | null, feet: FeetMark[]): string | null {
  if (!feet.length && !nose) return null
  const sorted = [...feet].sort((a, b) => FEET_OPTIONS.indexOf(a) - FEET_OPTIONS.indexOf(b))
  return (nose ? [nose, ...sorted] : sorted).join('-')
}
function parseMarking(m: string | null) {
  if (!m) return { nose: null as NoseMark | null, feet: [] as FeetMark[] }
  const parts = m.split('-')
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
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => selectNose(null)} className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${nose === null ? 'bg-accent border-accent text-canvas' : 'bg-canvas border-rim text-ink-2 hover:border-accent/40'}`}>None</button>
        {NOSE_OPTIONS.map(n => (
          <button key={n} onClick={() => selectNose(nose === n ? null : n)} className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${nose === n ? 'bg-accent border-accent text-canvas' : 'bg-canvas border-rim text-ink hover:border-accent/40'}`}>{n}</button>
        ))}
      </div>
      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Feet {nose ? '(optional)' : '(required)'}</p>
      <div className="flex flex-wrap gap-2 mb-4">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mating = {
  _id: string
  maleName: string
  sameMarking: boolean | null
  mandatoryMarking: string | null
  hens: { _id: string; henName: string }[]
}

export default function EditMatingPage() {
  const params   = useParams()
  const search   = useSearchParams()
  const router   = useRouter()
  const seasonId = params.seasonId as string
  const matingId = search.get('matingId') ?? ''

  const [maleName, setMaleName]           = useState('')
  const [henNames, setHenNames]           = useState([] as string[])
  const [sameMarking, setSameMarking]     = useState(null as boolean | null)
  const [mandatoryMarking, setMandatoryMarking] = useState(null as string | null)
  const [showPicker, setShowPicker]       = useState(false)
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    if (!matingId) return
    apiRequest(`/seasons/${seasonId}/matings/${matingId}`)
      .then(data => {
        const m = data as Mating
        setMaleName(m.maleName)
        setHenNames(m.hens.map(h => h.henName))
        setSameMarking(m.sameMarking)
        setMandatoryMarking(m.mandatoryMarking)
      })
      .catch(() => setError('Failed to load mating'))
      .finally(() => setLoading(false))
  }, [seasonId, matingId])

  function adjustCount(n: number) {
    if (n < 1) return
    setHenNames(prev => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
    if (n === 1) setSameMarking(null)
  }

  async function handleSave() {
    if (!maleName.trim())                  return setError('Male name is required')
    if (henNames.some(n => !n.trim()))     return setError('All hen names are required')
    if (henNames.length >= 2 && sameMarking === null)
                                           return setError('Choose same or different marking for hens')
    setSaving(true); setError('')
    try {
      await apiRequest(`/seasons/${seasonId}/matings/${matingId}`, {
        method: 'PATCH',
        body: {
          maleName: maleName.trim(),
          henNames: henNames.map(n => n.trim()),
          sameMarking: henNames.length === 1 ? null : sameMarking,
          mandatoryMarking: mandatoryMarking ?? null,
        },
      })
      router.push(`/breeder/marking-generator/${seasonId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-6 max-w-xl">
      <div className="h-4 w-32 bg-card rounded animate-pulse mb-6" />
      {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-card animate-pulse mb-3" />)}
    </div>
  )

  return (
    <div className="p-6 max-w-xl">
      <Link href={`/breeder/marking-generator/${seasonId}`} className="text-accent text-sm hover:opacity-80">
        ‹ Back to Season
      </Link>
      <h1 className="text-ink text-2xl font-bold mt-1 mb-6">Edit Mating</h1>

      {/* Male name */}
      <div className="mb-5">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Male Name</label>
        <input
          type="text"
          value={maleName}
          onChange={e => setMaleName(e.target.value)}
          placeholder="e.g. Raptor Sweater / Band #12 / Grey Kelso"
          autoFocus
          className="w-full bg-card border border-rim rounded-xl px-4 py-3.5 text-ink outline-none focus:border-accent placeholder:text-ink-3"
        />
      </div>

      {/* Hen count stepper */}
      <div className="mb-5">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Number of Hens</label>
        <div className="flex items-center bg-card border border-rim rounded-xl self-start w-36">
          <button
            onClick={() => adjustCount(henNames.length - 1)}
            disabled={henNames.length <= 1}
            className="w-12 h-12 flex items-center justify-center text-2xl font-light text-ink disabled:text-rim transition-colors"
          >−</button>
          <span className="text-ink text-lg font-bold w-12 text-center">{henNames.length}</span>
          <button
            onClick={() => adjustCount(henNames.length + 1)}
            className="w-12 h-12 flex items-center justify-center text-accent text-2xl font-light"
          >+</button>
        </div>
      </div>

      {/* Hen names */}
      <div className="mb-5">
        <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Hen Names</label>
        <div className="flex flex-col gap-2">
          {henNames.map((name, idx) => (
            <input
              key={idx}
              type="text"
              value={name}
              onChange={e => setHenNames(prev => prev.map((h, j) => j === idx ? e.target.value : h))}
              placeholder={`Hen ${idx + 1} — name, band no., or marking`}
              className="w-full bg-card border border-rim rounded-xl px-4 py-3.5 text-ink outline-none focus:border-accent placeholder:text-ink-3"
            />
          ))}
        </div>
      </div>

      {/* Same marking */}
      {henNames.length >= 2 && (
        <div className="mb-5">
          <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Same Marking for All Hens?</label>
          <div className="flex gap-3">
            {([{ label: 'Yes — Same', value: true }, { label: 'No — Different', value: false }] as const).map(({ label, value }) => (
              <button
                key={String(value)}
                onClick={() => setSameMarking(value)}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  sameMarking === value ? 'bg-accent/15 border-accent text-accent' : 'bg-card border-rim text-ink-2 hover:border-accent/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Force marking */}
      <div className="mb-6">
        <button
          onClick={() => setShowPicker(v => !v)}
          className="flex items-center justify-between w-full mb-3"
        >
          <div className="text-left">
            <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider">Force Marking (Optional)</p>
            <p className="text-ink-3 text-xs mt-1">Set a preferred combo for this male. TIKNOK assigns around it.</p>
          </div>
          <span className="text-accent text-sm ml-4 shrink-0">{showPicker ? 'Hide ▲' : 'Show ▼'}</span>
        </button>

        {mandatoryMarking && !showPicker && (
          <div className="bg-accent/10 border border-accent/25 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-ink-2 text-xs mb-0.5">Assigned marking</p>
              <p className="text-accent text-xl font-bold">{mandatoryMarking}</p>
            </div>
            <button onClick={() => setMandatoryMarking(null)} className="text-ink-2 text-sm hover:text-ink">Clear</button>
          </div>
        )}

        {showPicker && (
          <div className="bg-card border border-rim rounded-xl p-4">
            <MarkingPicker value={mandatoryMarking} onChange={setMandatoryMarking} />
            {mandatoryMarking && (
              <button onClick={() => { setMandatoryMarking(null); setShowPicker(false) }} className="mt-3 text-danger text-sm hover:opacity-80">
                Clear marking
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-accent/10 border border-accent/25 rounded-xl px-4 py-3 mb-4">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-4 transition-opacity disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
