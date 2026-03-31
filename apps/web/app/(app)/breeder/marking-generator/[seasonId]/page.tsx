'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type Season = {
  _id: string
  name: string
  year: number
  markingsGenerated: boolean
  eggsLaid: number | null
  expectedHatchDate: string | null
}

type Hen = {
  _id: string
  henName: string
  marking: string | null
  previousMarking: string | null
  eggsLaid: number | null
  chicksHatched: number | null
  maleCount: number | null
  femaleCount: number | null
}

type Mating = {
  _id: string
  maleName: string
  noseGroup: string | null
  sameMarking: boolean | null
  mandatoryMarking: string | null
  hens: Hen[]
  useIndividualHenCount: boolean
  penEggsLaid: number | null
  penChicksHatched: number | null
  penMaleCount: number | null
  penFemaleCount: number | null
  totalEggsLaid: number | null
  totalChicksHatched: number | null
  totalMaleCount: number | null
  totalFemaleCount: number | null
}

type EditValues = { eggs: string; hatched: string; males: string; females: string }
type SheetMode = 'detail' | 'edit'
type EditTarget = { type: 'hen'; hen: Hen } | { type: 'pen' }

const NOSE_GROUPS = ['LN', 'RN', 'DN', 'NONE'] as const

function numOnly(v: string) { return v.replace(/[^0-9]/g, '') }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeSeasonTotals(matings: Mating[]) {
  let eggs = 0, hatched = 0, males = 0, females = 0
  let hasEggs = false, hasHatch = false, hasSex = false
  for (const m of matings) {
    if (m.totalEggsLaid      != null) { eggs    += m.totalEggsLaid;      hasEggs = true }
    if (m.totalChicksHatched != null) { hatched += m.totalChicksHatched; hasHatch = true }
    if (m.totalMaleCount     != null) { males   += m.totalMaleCount;     hasSex = true }
    if (m.totalFemaleCount   != null) { females += m.totalFemaleCount;   hasSex = true }
  }
  return {
    eggsLaid:      hasEggs  ? eggs    : null,
    chicksHatched: hasHatch ? hatched : null,
    hatchRate:     hasEggs && hasHatch && eggs > 0 ? Math.round((hatched / eggs) * 1000) / 10 : null,
    maleCount:     hasSex   ? males   : null,
    femaleCount:   hasSex   ? females : null,
  }
}

function validateEdit(v: EditValues, label?: string): string | null {
  const e = v.eggs    !== '' ? parseInt(v.eggs)    : null
  const h = v.hatched !== '' ? parseInt(v.hatched) : null
  const m = v.males   !== '' ? parseInt(v.males)   : null
  const f = v.females !== '' ? parseInt(v.females) : null
  const p = label ? `${label}: ` : ''
  if (e != null && h != null && h > e) return `${p}Hatched (${h}) cannot exceed eggs laid (${e})`
  if (h != null && m != null && f != null && m + f > h) return `${p}Males + females (${m + f}) cannot exceed hatched (${h})`
  if (h != null && m != null && f == null && m > h) return `${p}Males (${m}) cannot exceed hatched (${h})`
  if (h != null && f != null && m == null && f > h) return `${p}Females (${f}) cannot exceed hatched (${h})`
  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LifecycleRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2 text-sm">{label}</span>
      <span className={`text-sm font-bold ${gold ? 'text-accent' : value === '—' ? 'text-ink-3' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

function InlineInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1">
      <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(numOnly(e.target.value))}
        placeholder="—"
        className="w-full bg-canvas border border-rim rounded-xl px-3 py-3 text-ink text-base outline-none focus:border-accent placeholder:text-ink-3 text-center"
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeasonDetailPage() {
  const params   = useParams()
  const seasonId = params.seasonId as string
  const router   = useRouter()

  const [season, setSeason]   = useState(null as Season | null)
  const [matings, setMatings] = useState([] as Mating[])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Mating detail sheet
  const [selectedMating, setSelectedMating] = useState(null as Mating | null)
  const [sheetMode, setSheetMode]           = useState('detail' as SheetMode)
  const [editTarget, setEditTarget]         = useState(null as EditTarget | null)
  const [editValues, setEditValues]         = useState({ eggs: '', hatched: '', males: '', females: '' } as EditValues)
  const [editSaving, setEditSaving]         = useState(false)
  const [editError, setEditError]           = useState('')
  const [deleting, setDeleting]             = useState(false)
  const [deleteConfirm, setDeleteConfirm]   = useState(false)

  // Add mating modal
  const [showAdd, setShowAdd]         = useState(false)
  const [maleName, setMaleName]       = useState('')
  const [noseGroup, setNoseGroup]     = useState('LN')
  const [sameMarking, setSameMarking] = useState(true)
  const [hens, setHens]               = useState([{ henName: '' }])
  const [addError, setAddError]       = useState('')
  const [addSaving, setAddSaving]     = useState(false)

  // Generate
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState('')

  // Season delete
  const [deletingSeason, setDeletingSeason]       = useState(false)
  const [deleteSeasonConfirm, setDeleteSeasonConfirm] = useState(false)

  const load = useCallback(async () => {
    try {
      setError('')
      const results = await Promise.all([
        apiRequest(`/seasons/${seasonId}`) as Promise<Season>,
        apiRequest(`/seasons/${seasonId}/matings`) as Promise<Mating[]>,
      ])
      setSeason(results[0])
      setMatings(results[1])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [seasonId])

  useEffect(() => { load() }, [load])

  // ── Mating sheet ─────────────────────────────────────────────────────────────

  function openMatingDetail(mating: Mating) {
    setSelectedMating(mating)
    setSheetMode('detail')
    setEditTarget(null)
    setEditError('')
    setDeleteConfirm(false)
  }

  function openHenEdit(hen: Hen) {
    setEditTarget({ type: 'hen', hen })
    setEditValues({
      eggs:    hen.eggsLaid      != null ? String(hen.eggsLaid)      : '',
      hatched: hen.chicksHatched != null ? String(hen.chicksHatched) : '',
      males:   hen.maleCount     != null ? String(hen.maleCount)     : '',
      females: hen.femaleCount   != null ? String(hen.femaleCount)   : '',
    })
    setEditError('')
    setSheetMode('edit')
  }

  function openPenEdit(mating: Mating) {
    setEditTarget({ type: 'pen' })
    setEditValues({
      eggs:    mating.penEggsLaid      != null ? String(mating.penEggsLaid)      : '',
      hatched: mating.penChicksHatched != null ? String(mating.penChicksHatched) : '',
      males:   mating.penMaleCount     != null ? String(mating.penMaleCount)     : '',
      females: mating.penFemaleCount   != null ? String(mating.penFemaleCount)   : '',
    })
    setEditError('')
    setSheetMode('edit')
  }

  async function handleSaveEdit() {
    if (!selectedMating || !editTarget) return
    const err = validateEdit(editValues, editTarget.type === 'hen' ? editTarget.hen.henName : undefined)
    if (err) { setEditError(err); return }
    setEditSaving(true)
    try {
      let body: object
      if (editTarget.type === 'hen') {
        body = {
          useIndividualHenCount: true,
          hens: [{
            henId:         editTarget.hen._id,
            eggsLaid:      editValues.eggs    !== '' ? parseInt(editValues.eggs)    : null,
            chicksHatched: editValues.hatched !== '' ? parseInt(editValues.hatched) : null,
            maleCount:     editValues.males   !== '' ? parseInt(editValues.males)   : null,
            femaleCount:   editValues.females !== '' ? parseInt(editValues.females) : null,
          }],
        }
      } else {
        body = {
          useIndividualHenCount: false,
          penEggsLaid:      editValues.eggs    !== '' ? parseInt(editValues.eggs)    : null,
          penChicksHatched: editValues.hatched !== '' ? parseInt(editValues.hatched) : null,
          penMaleCount:     editValues.males   !== '' ? parseInt(editValues.males)   : null,
          penFemaleCount:   editValues.females !== '' ? parseInt(editValues.females) : null,
        }
      }
      const updated = await apiRequest(`/seasons/${seasonId}/matings/${selectedMating._id}/lifecycle`, { method: 'PATCH', body }) as Mating
      setMatings(prev => prev.map(m => m._id === updated._id ? updated : m))
      setSelectedMating(updated)
      setSheetMode('detail')
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteMating() {
    if (!selectedMating) return
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      await apiRequest(`/seasons/${seasonId}/matings/${selectedMating._id}`, { method: 'DELETE' })
      setMatings(prev => prev.filter(m => m._id !== selectedMating._id))
      setSelectedMating(null)
    } catch { /* ignore */ } finally {
      setDeleting(false)
    }
  }

  async function handleKeepPrevious(prev: string) {
    if (!selectedMating) return
    try {
      const updated = await apiRequest(`/seasons/${seasonId}/matings/${selectedMating._id}`, {
        method: 'PATCH', body: { mandatoryMarking: prev },
      }) as Mating
      setMatings(p => p.map(m => m._id === updated._id ? updated : m))
      setSelectedMating(updated)
    } catch { /* ignore */ }
  }

  // ── Add mating ───────────────────────────────────────────────────────────────

  function openAdd() {
    setMaleName(''); setNoseGroup('LN'); setSameMarking(true)
    setHens([{ henName: '' }]); setAddError(''); setShowAdd(true)
  }

  async function handleAdd() {
    if (!maleName.trim())                        return setAddError('Male name is required')
    if (hens.some(h => !h.henName.trim()))       return setAddError('All hen names are required')
    setAddSaving(true); setAddError('')
    try {
      const created = await apiRequest(`/seasons/${seasonId}/matings`, {
        method: 'POST',
        body: {
          maleName: maleName.trim(),
          henCount: hens.length,
          henNames: hens.map(h => h.henName.trim()),
          sameMarking: hens.length === 1 ? null : sameMarking,
          mandatoryMarking: null,
        },
      }) as Mating
      setMatings(prev => [...prev, created])
      setShowAdd(false)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setAddSaving(false)
    }
  }

  // ── Generate ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true); setGenError('')
    try {
      await apiRequest(`/seasons/${seasonId}/generate`, { method: 'POST' })
      router.push(`/breeder/marking-generator/${seasonId}/generate`)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleResetMarkings() {
    try {
      await apiRequest(`/seasons/${seasonId}/generate`, { method: 'DELETE' })
      setSeason(s => s ? { ...s, markingsGenerated: false } : s)
      setMatings(prev => prev.map(m => ({ ...m, noseGroup: null, hens: m.hens.map(h => ({ ...h, marking: null })) })))
    } catch { /* ignore */ }
  }

  // ── Delete season ─────────────────────────────────────────────────────────────

  async function handleDeleteSeason() {
    if (!deleteSeasonConfirm) { setDeleteSeasonConfirm(true); return }
    setDeletingSeason(true)
    try {
      await apiRequest(`/seasons/${seasonId}`, { method: 'DELETE' })
      router.push('/breeder/marking-generator')
    } catch { setDeletingSeason(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const totals    = computeSeasonTotals(matings)
  const generated = season?.markingsGenerated ?? false

  if (loading) return (
    <div className="p-6 max-w-3xl">
      <div className="h-4 w-32 bg-card rounded animate-pulse mb-6" />
      <div className="h-32 rounded-xl bg-card animate-pulse mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-xl bg-card animate-pulse" />)}
      </div>
    </div>
  )

  if (error || !season) return (
    <div className="p-6 flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-danger">{error || 'Season not found'}</p>
      <button onClick={load} className="text-accent font-semibold">Retry</button>
    </div>
  )

  const hatchDate  = season.expectedHatchDate ? new Date(season.expectedHatchDate) : null
  const hatchLabel = hatchDate ? (() => {
    const diff = Math.ceil((hatchDate.getTime() - Date.now()) / 86400000)
    const str  = hatchDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    if (diff > 0)  return `${str} · in ${diff}d`
    if (diff === 0) return `${str} · today! 🐣`
    return `${str} · ${Math.abs(diff)}d ago`
  })() : null

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-5">
        <Link href="/breeder/marking-generator" className="text-accent text-sm hover:opacity-80">‹ Breeding Records</Link>
        <h1 className="text-ink text-2xl font-bold mt-1">{season.name}</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-ink-2 text-sm">{season.year}</span>
          <span className="text-rim">·</span>
          <span className="text-ink-2 text-sm">{matings.length} mating{matings.length !== 1 ? 's' : ''}</span>
          <span className="text-rim">·</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${generated ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
            Markings {generated ? 'Generated' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Breeding Totals card */}
      <div className="bg-card border border-rim rounded-xl p-4 mb-4">
        <p className="text-accent text-xs font-bold uppercase tracking-widest mb-3">Breeding Totals</p>
        <div className="flex flex-col gap-2">
          <LifecycleRow label="Eggs Incubated" value={totals.eggsLaid      != null ? String(totals.eggsLaid) : '—'} />
          <LifecycleRow label="Chicks Hatched" value={totals.chicksHatched != null ? `${totals.chicksHatched}${totals.hatchRate != null ? ` (${totals.hatchRate}%)` : ''}` : '—'} />
          <LifecycleRow label="Male / Female"  value={totals.maleCount     != null ? `${totals.maleCount}M / ${totals.femaleCount ?? '?'}F` : '—'} />
          {hatchLabel && (
            <div className="border-t border-rim pt-2 mt-1">
              <LifecycleRow label="Hatch Date" value={hatchLabel} gold />
            </div>
          )}
        </div>
        {totals.eggsLaid === null && matings.length > 0 && (
          <p className="text-ink-3 text-xs mt-3">Tap a mating card and tap a hen row to enter counts.</p>
        )}
        {matings.length === 0 && (
          <p className="text-ink-3 text-xs mt-3">Add matings below to start tracking.</p>
        )}
      </div>

      {/* Previous season markings notice */}
      {!generated && matings.some(m => m.hens.some(h => h.previousMarking)) && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-4">
          <p className="text-accent text-sm font-bold mb-1">Previous Season Markings</p>
          <p className="text-ink-2 text-sm leading-relaxed">
            This season was copied from a previous one. Each hen had a marking last season — keep it or let TIKNOK assign a new one.
          </p>
        </div>
      )}

      {/* Action row */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={openAdd}
          className="flex-1 bg-card border border-dashed border-rim rounded-xl py-3.5 text-accent font-semibold text-sm hover:border-accent/40 transition-colors"
        >
          + Add Mating
        </button>
        {matings.length > 0 && (
          <button
            onClick={generated ? handleResetMarkings : handleGenerate}
            disabled={generating}
            className={`flex-1 rounded-xl py-3.5 font-bold text-sm transition-opacity disabled:opacity-60 ${
              generated
                ? 'bg-card border border-warning/40 text-warning hover:border-warning/70'
                : 'bg-accent text-canvas hover:opacity-90'
            }`}
          >
            {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate Markings'}
          </button>
        )}
      </div>
      {genError && <p className="text-danger text-sm mb-3">{genError}</p>}

      {/* Save markings card button */}
      {generated && matings.some(m => m.hens.some(h => h.marking)) && (
        <button
          onClick={() => router.push(`/breeder/marking-generator/${seasonId}/generate`)}
          className="w-full bg-info hover:opacity-90 text-white font-bold rounded-xl py-3.5 mb-4 flex items-center justify-center gap-2 transition-opacity"
        >
          <span>🖼</span> View Markings Card
        </button>
      )}

      {/* Mating grid */}
      {matings.length === 0 ? (
        <div className="bg-card border border-rim rounded-xl p-10 text-center">
          <p className="text-3xl mb-2">🐓</p>
          <p className="text-ink font-semibold mb-1">No matings yet</p>
          <p className="text-ink-2 text-sm">Add your first mating to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {matings.map(m => {
            // Show markings in card
            const shownMarkings = m.sameMarking
              ? (m.hens[0]?.marking ? [{ marking: m.hens[0].marking, extra: m.hens.length > 1 ? m.hens.length : 0 }] : [])
              : m.hens.filter(h => h.marking).slice(0, 2).map(h => ({ marking: h.marking!, extra: 0 }))
            const extraCount = m.sameMarking ? 0 : Math.max(0, m.hens.filter(h => h.marking).length - 2)

            return (
              <button
                key={m._id}
                onClick={() => openMatingDetail(m)}
                className="bg-card border border-rim rounded-xl p-4 text-left hover:border-accent/30 transition-colors active:scale-[0.98]"
              >
                <p className="text-ink font-semibold text-sm leading-snug mb-0.5 line-clamp-2">{m.maleName}</p>
                <p className="text-ink-2 text-xs">
                  {m.hens.length} hen{m.hens.length !== 1 ? 's' : ''}
                  {m.sameMarking !== null && (m.sameMarking ? ' · Same' : ' · Diff')}
                </p>

                {/* Marking badges */}
                {shownMarkings.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {shownMarkings.map((mk, i) => (
                      <span key={i} className="bg-accent/15 text-accent text-xs font-bold px-2 py-0.5 rounded">
                        {mk.marking}{mk.extra > 1 ? ` ×${mk.extra}` : ''}
                      </span>
                    ))}
                    {extraCount > 0 && <span className="text-ink-3 text-xs self-center">+{extraCount}</span>}
                  </div>
                )}

                {/* Lifecycle mini */}
                {m.totalEggsLaid != null && (
                  <p className="text-ink-3 text-xs mt-2">
                    {m.totalEggsLaid} eggs{m.totalChicksHatched != null ? ` · ${m.totalChicksHatched} hatched` : ''}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Delete Season */}
      <div className="border-t border-rim pt-5 mb-8">
        <button
          onClick={handleDeleteSeason}
          disabled={deletingSeason}
          className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
            deleteSeasonConfirm
              ? 'bg-danger/10 border border-danger text-danger'
              : 'text-danger hover:opacity-80'
          }`}
        >
          {deletingSeason ? 'Deleting…' : deleteSeasonConfirm ? 'Tap again to confirm delete season' : 'Delete Season'}
        </button>
      </div>

      {/* ── Add Mating modal ──────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card-2 rounded-2xl w-full max-w-lg border border-rim max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-rim sticky top-0 bg-card-2">
              <h2 className="text-ink font-bold text-lg">Add Mating</h2>
              <button onClick={() => setShowAdd(false)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Male Name</label>
                <input
                  type="text"
                  value={maleName}
                  onChange={e => setMaleName(e.target.value)}
                  placeholder="e.g. Sweepstakes"
                  autoFocus
                  className="w-full bg-canvas border border-rim rounded-xl px-4 py-3 text-ink outline-none focus:border-accent placeholder:text-ink-3"
                />
              </div>
              <div>
                <label className="block text-ink-3 text-xs font-semibold uppercase tracking-wider mb-1.5">Nose Group</label>
                <div className="flex gap-2">
                  {NOSE_GROUPS.map(ng => (
                    <button
                      key={ng}
                      onClick={() => setNoseGroup(ng)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${noseGroup === ng ? 'bg-accent/20 border-accent text-accent' : 'bg-canvas border-rim text-ink-2'}`}
                    >
                      {ng}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-ink-3 text-xs font-semibold uppercase tracking-wider">Hens</label>
                  <button
                    onClick={() => setHens(prev => [...prev, { henName: '' }])}
                    className="text-accent text-xs font-bold hover:opacity-80"
                  >
                    + Add Hen
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {hens.map((hen, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={hen.henName}
                        onChange={e => setHens(prev => prev.map((h, j) => j === i ? { henName: e.target.value } : h))}
                        placeholder={`Hen ${i + 1} name`}
                        className="flex-1 bg-canvas border border-rim rounded-xl px-3 py-2.5 text-ink text-sm outline-none focus:border-accent placeholder:text-ink-3"
                      />
                      {hens.length > 1 && (
                        <button onClick={() => setHens(prev => prev.filter((_, j) => j !== i))} className="text-danger text-lg px-2">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {hens.length > 1 && (
                <div
                  className="flex items-center justify-between bg-canvas border border-rim rounded-xl px-4 py-3 cursor-pointer"
                  onClick={() => setSameMarking(v => !v)}
                >
                  <div>
                    <p className="text-ink font-semibold text-sm">Same marking for all hens</p>
                    <p className="text-ink-3 text-xs">All hens share one marking combo</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${sameMarking ? 'bg-accent' : 'bg-rim'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${sameMarking ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>
              )}
              {addError && <p className="text-danger text-sm">{addError}</p>}
              <button
                onClick={handleAdd}
                disabled={addSaving}
                className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-3.5 disabled:opacity-60"
              >
                {addSaving ? 'Adding…' : 'Add Mating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mating detail sheet ───────────────────────────────────────────────── */}
      {selectedMating && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
          <div className="bg-card-2 rounded-t-2xl w-full max-w-lg border border-rim border-b-0 max-h-[90vh] flex flex-col">

            {sheetMode === 'edit' && editTarget ? (
              // ── Edit form ────────────────────────────────────────────────────
              <>
                <div className="flex items-center justify-between p-5 border-b border-rim shrink-0">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setSheetMode('detail'); setEditError('') }} className="text-accent text-sm hover:opacity-80">‹ Back</button>
                    <div>
                      <p className="text-ink font-bold">
                        {editTarget.type === 'hen' ? editTarget.hen.henName : 'All Hens Combined'}
                      </p>
                      {editTarget.type === 'hen' && editTarget.hen.marking && (
                        <span className="bg-accent/15 text-accent text-xs font-bold px-2 py-0.5 rounded mt-0.5 inline-block">{editTarget.hen.marking}</span>
                      )}
                      {editTarget.type === 'pen' && (
                        <p className="text-ink-3 text-xs">{selectedMating.maleName}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedMating(null)} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
                </div>
                <div className="p-5 overflow-y-auto">
                  <div className="flex gap-3 mb-3">
                    <InlineInput label="Eggs Incubated" value={editValues.eggs}    onChange={v => { setEditValues(p => ({ ...p, eggs: v })); setEditError('') }} />
                    <InlineInput label="Chicks Hatched" value={editValues.hatched} onChange={v => { setEditValues(p => ({ ...p, hatched: v })); setEditError('') }} />
                  </div>
                  <div className="flex gap-3 mb-4">
                    <InlineInput label="Males"   value={editValues.males}   onChange={v => { setEditValues(p => ({ ...p, males: v })); setEditError('') }} />
                    <InlineInput label="Females" value={editValues.females} onChange={v => { setEditValues(p => ({ ...p, females: v })); setEditError('') }} />
                  </div>
                  {editError && (
                    <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 mb-4">
                      <p className="text-danger text-sm">{editError}</p>
                    </div>
                  )}
                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                    className="w-full bg-accent hover:opacity-90 text-canvas font-bold rounded-xl py-4 transition-opacity disabled:opacity-60"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            ) : (
              // ── Detail view ───────────────────────────────────────────────────
              <>
                <div className="overflow-y-auto flex-1">
                  {/* Sheet header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-card-2 border border-rim flex items-center justify-center text-xl shrink-0">🐓</div>
                      <p className="text-ink text-xl font-bold truncate">{selectedMating.maleName}</p>
                    </div>
                    <button onClick={() => setSelectedMating(null)} className="text-ink-3 hover:text-ink text-2xl leading-none ml-3 shrink-0">✕</button>
                  </div>
                  <div className="flex flex-wrap gap-2 px-5 pb-4">
                    <span className="bg-canvas rounded-full px-3 py-1 text-ink-2 text-xs">
                      {selectedMating.hens.length} hen{selectedMating.hens.length !== 1 ? 's' : ''}
                    </span>
                    {selectedMating.sameMarking !== null && (
                      <span className="bg-canvas rounded-full px-3 py-1 text-ink-2 text-xs">
                        {selectedMating.sameMarking ? 'Same marking' : 'Diff markings'}
                      </span>
                    )}
                    {selectedMating.noseGroup && selectedMating.noseGroup !== 'NONE' && (
                      <span className="bg-accent/15 text-accent rounded-full px-3 py-1 text-xs font-bold">{selectedMating.noseGroup}</span>
                    )}
                  </div>

                  {/* Keep previous marking */}
                  {!generated && selectedMating.sameMarking && !selectedMating.mandatoryMarking &&
                   selectedMating.hens.some(h => h.previousMarking) && (() => {
                    const prev = selectedMating.hens.find(h => h.previousMarking)?.previousMarking
                    if (!prev) return null
                    return (
                      <button
                        onClick={() => handleKeepPrevious(prev)}
                        className="mx-5 mb-3 w-[calc(100%-40px)] bg-accent/10 border border-accent/25 rounded-xl px-4 py-3 text-left flex items-center justify-between hover:bg-accent/15 transition-colors"
                      >
                        <span className="text-accent text-sm">
                          Keep previous marking: <strong>{prev}</strong>
                        </span>
                        <span className="text-accent text-xs">Set ›</span>
                      </button>
                    )
                  })()}

                  {selectedMating.mandatoryMarking && (
                    <div className="mx-5 mb-3 bg-canvas border border-rim rounded-xl px-4 py-3">
                      <p className="text-ink-2 text-xs mb-1">Force Marking</p>
                      <p className="text-accent font-bold text-lg">{selectedMating.mandatoryMarking}</p>
                    </div>
                  )}

                  {/* Hen rows — diff marking: each row tappable */}
                  {selectedMating.sameMarking !== true ? (
                    <div className="px-5 pb-4">
                      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">
                        Hens — tap row to update counts
                      </p>
                      <div className="flex flex-col gap-2">
                        {selectedMating.hens.map((hen, idx) => (
                          <button
                            key={hen._id}
                            onClick={() => openHenEdit(hen)}
                            className="bg-canvas border border-rim rounded-xl px-4 py-3 flex items-center gap-3 text-left hover:border-accent/30 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-ink-3 text-xs">Hen {idx + 1}</p>
                              <p className="text-ink font-semibold text-sm">{hen.henName}</p>
                              {!hen.marking && hen.previousMarking && (
                                <p className="text-ink-3 text-xs mt-0.5">prev: {hen.previousMarking}</p>
                              )}
                            </div>
                            {hen.marking && (
                              <span className="bg-accent/15 text-accent text-xs font-bold px-2 py-1 rounded shrink-0">{hen.marking}</span>
                            )}
                            {hen.eggsLaid != null ? (
                              <div className="text-right shrink-0">
                                <p className="text-accent text-xs">🥚{hen.eggsLaid} 🐣{hen.chicksHatched ?? '—'}</p>
                                {hen.maleCount != null && (
                                  <p className="text-ink-3 text-xs">♂{hen.maleCount} ♀{hen.femaleCount ?? '?'}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-3 text-xs shrink-0">add counts</span>
                            )}
                            <span className="text-ink-3 text-sm">›</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Same marking — static hen list + pen total row
                    <div className="px-5 pb-4">
                      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Hens</p>
                      <div className="flex flex-col gap-2 mb-4">
                        {selectedMating.hens.map((hen, idx) => (
                          <div key={hen._id} className="bg-canvas border border-rim rounded-xl px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-ink-3 text-xs">Hen {idx + 1}</p>
                              <p className="text-ink font-semibold text-sm">{hen.henName}</p>
                              {!hen.marking && hen.previousMarking && (
                                <p className="text-ink-3 text-xs mt-0.5">prev: {hen.previousMarking}</p>
                              )}
                            </div>
                            {hen.marking && (
                              <span className="bg-accent/15 text-accent text-xs font-bold px-2 py-1 rounded shrink-0">{hen.marking}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-2">Egg & Hatch Count</p>
                      <button
                        onClick={() => openPenEdit(selectedMating)}
                        className="w-full bg-canvas border border-rim rounded-xl px-4 py-3.5 flex items-center text-left hover:border-accent/30 transition-colors"
                      >
                        <div className="flex-1">
                          {selectedMating.penEggsLaid != null ? (
                            <div className="flex flex-col gap-1">
                              <p className="text-ink text-sm">
                                🥚 <strong>{selectedMating.penEggsLaid}</strong>
                                <span className="text-ink-3"> eggs  </span>
                                🐣 <strong>{selectedMating.penChicksHatched ?? '—'}</strong>
                                <span className="text-ink-3"> hatched</span>
                              </p>
                              {selectedMating.penMaleCount != null && (
                                <p className="text-ink-2 text-sm">♂{selectedMating.penMaleCount} ♀{selectedMating.penFemaleCount ?? '?'}</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-ink-3 text-sm">No counts yet — tap to add</p>
                          )}
                        </div>
                        <span className="text-ink-3 text-sm ml-3">
                          {selectedMating.penEggsLaid != null ? 'Edit ›' : '›'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom actions */}
                <div className="px-5 py-4 border-t border-rim flex flex-col gap-2 shrink-0">
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedMating(null)
                        router.push(`/breeder/marking-generator/${seasonId}/mating/edit?matingId=${selectedMating._id}`)
                      }}
                      className="flex-1 bg-canvas border border-rim rounded-xl py-3.5 text-ink font-semibold text-sm hover:border-accent/30 transition-colors"
                    >
                      Edit Mating
                    </button>
                    <button
                      onClick={handleDeleteMating}
                      disabled={deleting}
                      className={`flex-1 rounded-xl py-3.5 font-semibold text-sm border transition-colors disabled:opacity-60 ${
                        deleteConfirm ? 'bg-danger/10 border-danger text-danger' : 'bg-danger/10 border-danger/25 text-danger hover:border-danger/60'
                      }`}
                    >
                      {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm?' : 'Delete'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
