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

type SeasonInfo = {
  name: string
  year: number
}

type Props =
  | { mode: 'season'; season: SeasonInfo; matings: Mating[] }
  | { mode: 'mating'; season: SeasonInfo; mating: Mating }

const CARD_WIDTH = 390
const NOSE_COLOR: Record<string, string> = {
  LN: '#3B82F6',
  RN: '#F59E0B',
  DN: '#22C55E',
}

function NoseBadge({ group }: { group: string }) {
  const color = NOSE_COLOR[group] ?? '#A0A0A0'
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + '55' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{group}</Text>
    </View>
  )
}

function MarkingBadge({ marking }: { marking: string }) {
  return (
    <View style={{ backgroundColor: '#C8A84B22', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#C8A84B44' }}>
      <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>{marking}</Text>
    </View>
  )
}

function CardHeader({ season }: { season: SeasonInfo }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '800', letterSpacing: 2 }}>TIKNOK</Text>
        <Text style={{ color: '#404040', fontSize: 12 }}>{season.year}</Text>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 22 }}>{season.name}</Text>
      <View style={{ height: 1, backgroundColor: '#2A2A2A', marginTop: 14 }} />
    </View>
  )
}

function CardFooter() {
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ height: 1, backgroundColor: '#2A2A2A', marginBottom: 12 }} />
      <Text style={{ color: '#404040', fontSize: 11, textAlign: 'center' }}>
        Generated via TIKNOK — Gamefowl Farm OS
      </Text>
    </View>
  )
}

function MatingBlock({ mating }: { mating: Mating }) {
  const markedHens = mating.hens.filter((h) => h.marking)
  if (markedHens.length === 0) return null

  return (
    <View style={{ backgroundColor: '#141414', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A2A2A' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13, flex: 1, marginRight: 8 }} numberOfLines={2}>
          {mating.maleName}
        </Text>
        {mating.noseGroup && <NoseBadge group={mating.noseGroup} />}
      </View>
      <View style={{ gap: 5 }}>
        {markedHens.map((hen) => (
          <View key={hen._id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#A0A0A0', fontSize: 12, flex: 1, marginRight: 8 }} numberOfLines={1}>
              {hen.henName}
            </Text>
            {hen.marking && <MarkingBadge marking={hen.marking} />}
          </View>
        ))}
      </View>
    </View>
  )
}

const MarkingExportCard = forwardRef<View, Props>((props, ref) => {
  return (
    <View
      ref={ref}
      style={{
        width: CARD_WIDTH,
        backgroundColor: '#0A0A0A',
        padding: 20,
        position: 'absolute',
        left: CARD_WIDTH + 200,
        top: 0,
      }}
    >
      <CardHeader season={props.season} />

      {props.mode === 'season' ? (
        <View style={{ gap: 10 }}>
          {props.matings.map((m) => (
            <MatingBlock key={m._id} mating={m} />
          ))}
        </View>
      ) : (
        /* Single mating card */
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', flex: 1, marginRight: 10 }}>
              {props.mating.maleName}
            </Text>
            {props.mating.noseGroup && <NoseBadge group={props.mating.noseGroup} />}
          </View>
          {props.mating.sameMarking !== null && (
            <Text style={{ color: '#606060', fontSize: 12, marginBottom: 12 }}>
              {props.mating.sameMarking ? 'Same marking for all hens' : 'Individual markings per hen'}
            </Text>
          )}
          <View style={{ gap: 8 }}>
            {props.mating.hens.map((hen, idx) => (
              <View
                key={hen._id}
                style={{ backgroundColor: '#141414', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#2A2A2A', flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#606060', fontSize: 10, marginBottom: 1 }}>Hen {idx + 1}</Text>
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>{hen.henName}</Text>
                </View>
                {hen.marking
                  ? <MarkingBadge marking={hen.marking} />
                  : <Text style={{ color: '#404040', fontSize: 12 }}>—</Text>
                }
              </View>
            ))}
          </View>
        </View>
      )}

      <CardFooter />
    </View>
  )
})

MarkingExportCard.displayName = 'MarkingExportCard'

export default MarkingExportCard
