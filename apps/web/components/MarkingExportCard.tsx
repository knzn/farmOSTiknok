import { forwardRef } from 'react'

type Hen = { _id: string; henName: string; marking: string | null }

type Mating = {
  _id: string
  maleName: string
  noseGroup: string | null
  sameMarking: boolean | null
  hens: Hen[]
}

type SeasonTotals = {
  eggsLaid: number | null
  chicksHatched: number | null
  hatchRate: number | null
  maleCount: number | null
  femaleCount: number | null
}

type Props = {
  farmName: string
  ownerName: string
  season: { name: string; year: number }
  matings: Mating[]
  includeBreedingTotals: boolean
  totals: SeasonTotals
  expectedHatchDate: string | null
}

const NOSE_COLOR: Record<string, string> = {
  LN: '#3B82F6',
  RN: '#F59E0B',
  DN: '#22C55E',
}

function MatingBlock({ mating }: { mating: Mating }) {
  const markedHens = mating.hens.filter(h => h.marking)
  if (!markedHens.length) return null
  const noseColor = mating.noseGroup ? (NOSE_COLOR[mating.noseGroup] ?? '#A0A0A0') : null

  return (
    <div style={{
      backgroundColor: '#141414',
      borderRadius: 8,
      padding: 10,
      border: '1px solid #2A2A2A',
      width: '48%',
      boxSizing: 'border-box',
    }}>
      <p style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 12, marginBottom: 4, wordBreak: 'break-word' }}>
        {mating.maleName}
      </p>
      {noseColor && (
        <div style={{
          display: 'inline-block',
          backgroundColor: noseColor + '22',
          borderRadius: 5,
          padding: '2px 7px',
          border: `1px solid ${noseColor}55`,
          marginBottom: 6,
        }}>
          <span style={{ color: noseColor, fontSize: 10, fontWeight: 700 }}>{mating.noseGroup}</span>
        </div>
      )}
      <div style={{ height: 1, backgroundColor: '#2A2A2A', marginBottom: 6 }} />
      {markedHens.map(hen => {
        const color = noseColor ?? '#C8A84B'
        return (
          <div key={hen._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ color: '#808080', fontSize: 11, flex: 1, marginRight: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hen.henName}
            </span>
            <span style={{ color, fontSize: 11, fontWeight: 700 }}>{hen.marking}</span>
          </div>
        )
      })}
    </div>
  )
}

const MarkingExportCard = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { farmName, ownerName, season, matings, includeBreedingTotals, totals, expectedHatchDate } = props
  const displayFarm  = farmName.trim()  || 'TIKNOK'
  const displayOwner = ownerName.trim()
  const savedDate    = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

  const hatchDate   = expectedHatchDate ? new Date(expectedHatchDate) : null
  const hatchIsPast = hatchDate && hatchDate < new Date()
  const hatchLabel  = hatchIsPast ? 'Hatch Date' : 'Expected Hatch'
  const hatchStr    = hatchDate
    ? hatchDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div
      ref={ref}
      style={{
        width: 780,
        backgroundColor: '#0A0A0A',
        padding: 40,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'absolute',
        left: -9999,
        top: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <p style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, flex: 1, marginRight: 16 }}>
          {displayFarm}
        </p>
        <p style={{ color: '#606060', fontSize: 16, fontWeight: 600, marginTop: 4 }}>{season.year}</p>
      </div>
      {displayOwner && <p style={{ color: '#A0A0A0', fontSize: 14, marginBottom: 4 }}>{displayOwner}</p>}
      <p style={{ color: '#C8A84B', fontSize: 14, fontWeight: 600 }}>{season.name}</p>

      <div style={{ height: 1, backgroundColor: '#2A2A2A', margin: '20px 0' }} />

      {/* Breeding totals */}
      {includeBreedingTotals && (
        <div style={{ marginBottom: 0 }}>
          <p style={{ color: '#C8A84B', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
            Breeding Totals
          </p>
          {[
            ['Eggs Incubated',  totals.eggsLaid != null ? String(totals.eggsLaid) : '—'],
            ['Chicks Hatched',  totals.chicksHatched != null ? `${totals.chicksHatched}${totals.hatchRate != null ? ` (${totals.hatchRate}%)` : ''}` : '—'],
            ['Male / Female',   totals.maleCount != null ? `${totals.maleCount}M / ${totals.femaleCount ?? '?'}F` : '—'],
            ...(hatchStr ? [[hatchLabel, hatchStr]] : []),
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
              <span style={{ color: '#A0A0A0', fontSize: 12 }}>{label}</span>
              <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <div style={{ height: 1, backgroundColor: '#2A2A2A', margin: '16px 0' }} />
        </div>
      )}

      {/* Mating grid */}
      <p style={{ color: '#606060', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
        Matings — {matings.length} pair{matings.length !== 1 ? 's' : ''}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {matings.map(m => <MatingBlock key={m._id} mating={m} />)}
      </div>

      {/* Footer */}
      <div style={{ height: 1, backgroundColor: '#2A2A2A', margin: '20px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#404040', fontSize: 10 }}>Saved: {savedDate}</span>
        <span style={{ color: '#C8A84B', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>TIKNOK</span>
      </div>
    </div>
  )
})

MarkingExportCard.displayName = 'MarkingExportCard'
export default MarkingExportCard
export type { SeasonTotals, Mating as ExportMating }
