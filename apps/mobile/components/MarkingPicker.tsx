import { View, Text, TouchableOpacity } from 'react-native'
import { useState } from 'react'

type NoseMark = 'LN' | 'RN' | 'DN'
type FeetMark = 'LO' | 'RO' | 'LI' | 'RI' | 'DL' | 'DR' | 'OO' | 'II'

const NOSE_OPTIONS: NoseMark[] = ['LN', 'RN', 'DN']
const FEET_OPTIONS: FeetMark[] = ['LO', 'RO', 'LI', 'RI', 'DL', 'DR', 'OO', 'II']
const FEET_ORDER = FEET_OPTIONS

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
  const sorted = [...feet].sort((a, b) => FEET_ORDER.indexOf(a) - FEET_ORDER.indexOf(b))
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

type Props = {
  value: string | null
  onChange: (marking: string | null) => void
}

export function MarkingPicker({ value, onChange }: Props) {
  const parsed = parseMarking(value)
  const [nose, setNose] = useState<NoseMark | null>(parsed.nose)
  const [feet, setFeet] = useState<FeetMark[]>(parsed.feet)

  function selectNose(n: NoseMark | null) {
    setNose(n)
    onChange(buildMarking(n, feet))
  }

  function toggleFeet(mark: FeetMark) {
    const isSelected = feet.includes(mark)
    let newFeet: FeetMark[]
    if (isSelected) {
      newFeet = feet.filter((f) => f !== mark)
    } else {
      const conflicts = CONFLICTS[mark] ?? []
      newFeet = [...feet.filter((f) => !conflicts.includes(f)), mark]
    }
    setFeet(newFeet)
    onChange(buildMarking(nose, newFeet))
  }

  function isDisabled(mark: FeetMark) {
    return !feet.includes(mark) && feet.some((f) => CONFLICTS[f]?.includes(mark))
  }

  const preview = buildMarking(nose, feet)

  return (
    <View>
      {/* Nose */}
      <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
        Nose (optional)
      </Text>
      <View className="flex-row gap-2 mb-5">
        <TouchableOpacity
          className={`px-4 py-2.5 rounded-lg border ${nose === null ? 'bg-accent border-accent' : 'bg-canvas border-rim'}`}
          onPress={() => selectNose(null)}
        >
          <Text
            className={`text-sm font-semibold ${nose === null ? 'text-white' : 'text-ink-2'}`}
          >
            None
          </Text>
        </TouchableOpacity>
        {NOSE_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            className={`px-4 py-2.5 rounded-lg border ${nose === n ? 'bg-accent border-accent' : 'bg-canvas border-rim'}`}
            onPress={() => selectNose(nose === n ? null : n)}
          >
            <Text
              className={`text-sm font-semibold ${nose === n ? 'text-white' : 'text-ink'}`}
            >
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feet */}
      <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
        Feet {nose ? '(optional)' : '(required)'}
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-5">
        {FEET_OPTIONS.map((f) => {
          const selected = feet.includes(f)
          const disabled = isDisabled(f)
          return (
            <TouchableOpacity
              key={f}
              className={`px-4 py-2.5 rounded-lg border ${
                selected
                  ? 'bg-secondary border-secondary'
                  : disabled
                    ? 'bg-canvas border-rim opacity-30'
                    : 'bg-canvas border-rim'
              }`}
              onPress={() => !disabled && toggleFeet(f)}
              disabled={disabled}
            >
              <Text
                className={`text-sm font-semibold ${selected ? 'text-white' : disabled ? 'text-ink-2' : 'text-ink'}`}
              >
                {f}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Preview */}
      <View className="bg-canvas rounded-xl px-4 py-3 items-center border border-rim">
        <Text className="text-ink-2 text-xs mb-1">Preview</Text>
        <Text className="text-secondary text-2xl font-bold">{preview ?? '—'}</Text>
      </View>
    </View>
  )
}
