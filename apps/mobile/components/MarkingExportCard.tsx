import { forwardRef } from 'react'
import { View, Text } from 'react-native'

type Hen = {
  _id: string
  henName: string
  marking: string | null
}

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

type BaseProps = {
  farmName: string
  ownerName: string
  season: { name: string; year: number }
}

type Props = BaseProps &
  (
    | {
        mode: 'season'
        matings: Mating[]
        includeBreedingTotals: boolean
        totals: SeasonTotals
        expectedHatchDate: string | null
      }
    | {
        mode: 'mating'
        mating: Mating
      }
  )

const CARD_WIDTH = 390

const NOSE_COLOR: Record<string, string> = {
  LN: '#3B82F6',
  RN: '#F59E0B',
  DN: '#22C55E',
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#2A2A2A', marginVertical: 14 }} />
}

function NoseBadge({ group }: { group: string }) {
  const color = NOSE_COLOR[group] ?? '#A0A0A0'
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: color + '55', alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{group}</Text>
    </View>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text style={{ color: '#A0A0A0', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

function MatingBlock({ mating }: { mating: Mating }) {
  const markedHens = mating.hens.filter((h) => h.marking)
  if (markedHens.length === 0) return null

  return (
    <View style={{ backgroundColor: '#141414', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#2A2A2A' }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12, marginBottom: 4 }} numberOfLines={2}>
        {mating.maleName}
      </Text>
      {mating.noseGroup && (
        <View style={{ marginBottom: 6 }}>
          <NoseBadge group={mating.noseGroup} />
        </View>
      )}
      <View style={{ height: 1, backgroundColor: '#2A2A2A', marginBottom: 6 }} />
      <View style={{ gap: 3 }}>
        {markedHens.map((hen) => {
          const color = mating.noseGroup ? (NOSE_COLOR[mating.noseGroup] ?? '#C8A84B') : '#C8A84B'
          return (
            <View key={hen._id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#808080', fontSize: 11, flex: 1, marginRight: 4 }} numberOfLines={1}>
                {hen.henName}
              </Text>
              <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{hen.marking}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const MarkingExportCard = forwardRef<View, Props>((props, ref) => {
  const { farmName, ownerName, season } = props

  const displayFarm = farmName.trim() || 'TIKNOK'
  const displayOwner = ownerName.trim()

  const savedDate = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <View
      ref={ref}
      style={{
        width: CARD_WIDTH,
        backgroundColor: '#0A0A0A',
        padding: 20,
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8, textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={2}>
          {displayFarm}
        </Text>
        <Text style={{ color: '#606060', fontSize: 13, fontWeight: '600', marginTop: 2 }}>{season.year}</Text>
      </View>
      {displayOwner ? (
        <Text style={{ color: '#A0A0A0', fontSize: 13, marginBottom: 2 }}>{displayOwner}</Text>
      ) : null}
      <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>{season.name}</Text>

      <Divider />

      {/* Breeding totals — season mode only */}
      {props.mode === 'season' && props.includeBreedingTotals && (() => {
        const { totals, expectedHatchDate } = props
        const hatchDate = expectedHatchDate ? new Date(expectedHatchDate) : null
        const hatchIsPast = hatchDate && hatchDate < new Date()
        const hatchLabel = hatchIsPast ? 'Hatch Date' : 'Expected Hatch'
        const hatchStr = hatchDate
          ? hatchDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          : null

        return (
          <View style={{ marginBottom: 0 }}>
            <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
              Breeding Totals
            </Text>
            <TotalRow label="Eggs Incubated" value={totals.eggsLaid != null ? String(totals.eggsLaid) : '—'} />
            <TotalRow
              label="Chicks Hatched"
              value={totals.chicksHatched != null
                ? `${totals.chicksHatched}${totals.hatchRate != null ? ` (${totals.hatchRate}%)` : ''}`
                : '—'}
            />
            <TotalRow
              label="Male / Female"
              value={totals.maleCount != null ? `${totals.maleCount}M / ${totals.femaleCount ?? '?'}F` : '—'}
            />
            {hatchStr && (
              <TotalRow label={hatchLabel} value={hatchStr} />
            )}
            <Divider />
          </View>
        )
      })()}

      {/* Body */}
      {props.mode === 'season' ? (
        <View>
          <Text style={{ color: '#606060', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Matings — {props.matings.length} pair{props.matings.length !== 1 ? 's' : ''}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {props.matings.map((m) => (
              <View key={m._id} style={{ width: '48.3%' }}>
                <MatingBlock mating={m} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', flex: 1, marginRight: 8 }}>
              {props.mating.maleName}
            </Text>
            {props.mating.noseGroup && <NoseBadge group={props.mating.noseGroup} />}
          </View>
          {props.mating.sameMarking !== null && (
            <Text style={{ color: '#606060', fontSize: 11, marginBottom: 10 }}>
              {props.mating.sameMarking ? 'Same marking for all hens' : 'Individual markings per hen'}
            </Text>
          )}
          <View style={{ gap: 6 }}>
            {props.mating.hens.map((hen, idx) => {
              const color = props.mating.noseGroup ? (NOSE_COLOR[props.mating.noseGroup] ?? '#C8A84B') : '#C8A84B'
              return (
                <View key={hen._id} style={{ backgroundColor: '#141414', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#2A2A2A', flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#606060', fontSize: 10, marginBottom: 1 }}>Hen {idx + 1}</Text>
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>{hen.henName}</Text>
                  </View>
                  {hen.marking
                    ? <Text style={{ color, fontSize: 14, fontWeight: '800' }}>{hen.marking}</Text>
                    : <Text style={{ color: '#404040', fontSize: 12 }}>—</Text>
                  }
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Footer */}
      <Divider />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#404040', fontSize: 10 }}>Saved: {savedDate}</Text>
        <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>TIKNOK</Text>
      </View>
    </View>
  )
})

MarkingExportCard.displayName = 'MarkingExportCard'

export default MarkingExportCard
export type { SeasonTotals, Mating as ExportMating }
