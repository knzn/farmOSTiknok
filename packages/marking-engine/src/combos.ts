/**
 * All valid marking combinations.
 * Pure data — no side effects.
 */

export type NoseMark = 'LN' | 'RN' | 'DN'
export type FeetMark = 'LO' | 'RO' | 'LI' | 'RI' | 'DL' | 'DR' | 'OO' | 'II'
export type NoseGroup = 'LN' | 'RN' | 'DN' | 'NONE' | 'OVERFLOW'
export type MarkPart = NoseMark | FeetMark

export const NOSE_MARKS: NoseMark[] = ['LN', 'RN', 'DN']
export const FEET_MARKS: FeetMark[] = ['LO', 'RO', 'LI', 'RI', 'DL', 'DR', 'OO', 'II']

// Shorthands expand to their component marks
export const SHORTHAND_EXPANSIONS: Record<string, FeetMark[]> = {
  DL: ['LO', 'LI'],
  DR: ['RO', 'RI'],
  OO: ['LO', 'RO'],
  II: ['LI', 'RI'],
}

// Conflict pairs: if you pick X you cannot also pick Y
// Derived from the expansion table in CLAUDE.md
export const CONFLICTS: Array<[FeetMark, FeetMark]> = [
  ['LO', 'DL'],
  ['LI', 'DL'],
  ['RO', 'DR'],
  ['RI', 'DR'],
  ['LO', 'OO'],
  ['RO', 'OO'],
  ['LI', 'II'],
  ['RI', 'II'],
  ['DL', 'OO'],
  ['DR', 'OO'],
  ['DL', 'II'],
  ['DR', 'II'],
]

// Nose group priority order
export const NOSE_PRIORITY: Array<NoseGroup> = ['LN', 'RN', 'DN', 'NONE']

/**
 * Build the canonical combo string from nose + feet parts.
 * Format: [nose-]feet1[-feet2...]  sorted by FEET_MARKS order.
 */
export function buildComboString(nose: NoseMark | null, feet: FeetMark[]): string {
  if (feet.length === 0 && !nose) {
    throw new Error('At least one mark (nose or feet) is required')
  }
  // Nose-only marking (e.g. 'LN', 'RN', 'DN')
  if (feet.length === 0) {
    return nose!
  }
  const sortedFeet = [...feet].sort(
    (a, b) => FEET_MARKS.indexOf(a) - FEET_MARKS.indexOf(b),
  )
  if (nose) {
    return [nose, ...sortedFeet].join('-')
  }
  return sortedFeet.join('-')
}

/**
 * Returns the nose group that owns a given combo.
 */
export function getNoseGroup(combo: string): NoseGroup {
  const parts = combo.split('-')
  const first = parts[0] as string
  if (first === 'LN') return 'LN'
  if (first === 'RN') return 'RN'
  if (first === 'DN') return 'DN'
  return 'NONE'
}

/**
 * Check if two feet marks conflict with each other.
 */
export function conflictsWith(a: FeetMark, b: FeetMark): boolean {
  return CONFLICTS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  )
}

/**
 * Return all conflicting feet marks for a given set of current selections.
 */
export function getConflicts(selected: FeetMark[]): FeetMark[] {
  const blocked = new Set<FeetMark>()
  for (const mark of selected) {
    for (const other of FEET_MARKS) {
      if (!selected.includes(other) && conflictsWith(mark, other)) {
        blocked.add(other)
      }
    }
  }
  return [...blocked]
}

/**
 * Generate every valid feet combination.
 * Valid = no two selected marks conflict.
 */
function generateAllFeetCombos(): FeetMark[][] {
  const results: FeetMark[][] = []

  // Power set of FEET_MARKS (excluding empty)
  const n = FEET_MARKS.length
  for (let mask = 1; mask < 1 << n; mask++) {
    const combo: FeetMark[] = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) combo.push(FEET_MARKS[i]!)
    }

    // Check for conflicts within this combo
    let valid = true
    outer: for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        if (conflictsWith(combo[i]!, combo[j]!)) {
          valid = false
          break outer
        }
      }
    }
    // Also: LO+LI without DL is invalid (should use DL instead)
    // RO+RI without DR is invalid (should use DR instead)
    if (
      combo.includes('LO') &&
      combo.includes('LI') &&
      !combo.includes('DL')
    ) {
      valid = false
    }
    if (
      combo.includes('RO') &&
      combo.includes('RI') &&
      !combo.includes('DR')
    ) {
      valid = false
    }

    if (valid) results.push(combo)
  }
  return results
}

// All valid combos, pre-computed at module load
let _allValidCombos: string[] | null = null

export function getAllValidCombos(): string[] {
  if (_allValidCombos) return _allValidCombos

  const combos: string[] = []
  const feetCombos = generateAllFeetCombos()

  // Nose-only combos: LN, RN, DN (valid standalone markings per spec)
  for (const nose of NOSE_MARKS) {
    combos.push(nose)
  }

  // Feet-only (NONE group)
  for (const feet of feetCombos) {
    combos.push(buildComboString(null, feet))
  }

  // Nose + feet
  for (const nose of NOSE_MARKS) {
    for (const feet of feetCombos) {
      combos.push(buildComboString(nose, feet))
    }
  }

  _allValidCombos = combos
  return combos
}

/**
 * Returns all valid combos that belong to a given nose group.
 */
export function getCombosByGroup(group: NoseGroup): string[] {
  return getAllValidCombos().filter((c) => getNoseGroup(c) === group)
}
