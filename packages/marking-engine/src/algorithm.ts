import {
  NOSE_PRIORITY,
  getCombosByGroup,
  getNoseGroup,
} from './combos.js'
import type {
  MatingInput,
  MandatoryOverride,
  MarkingAssignment,
  NoseGroup,
  HenAssignment,
} from './types.js'
import { isValidCombo } from './validate.js'

/**
 * Main marking generation algorithm.
 * Pure function — no DB calls, no side effects.
 *
 * Execution order per CLAUDE.md spec:
 * 1. Process mandatory markings first → lock their nose groups
 * 2. Assign remaining matings to next available nose group by priority
 * 3. Same-marking: 1 combo for all hens
 * 4. Diff-marking: 1 unique combo per hen
 * 5. Overflow: pull from group with most remaining unused combos
 * 6. Return proposed assignment — caller decides whether to save
 */
export function generateMarkings(
  matings: MatingInput[],
  mandatoryOverrides: MandatoryOverride[] = [],
): MarkingAssignment[] {
  if (matings.length === 0) return []

  // Build a lookup of mandatory overrides by matingId
  const overrideMap = new Map<string, string>()
  for (const ov of mandatoryOverrides) {
    if (!isValidCombo(ov.marking)) {
      throw new Error(`Invalid mandatory marking: ${ov.marking}`)
    }
    overrideMap.set(ov.matingId, ov.marking)
  }

  // Also pull mandatoryMarking from the mating itself (set during create)
  for (const m of matings) {
    if (m.mandatoryMarking && !overrideMap.has(m.id)) {
      if (!isValidCombo(m.mandatoryMarking)) {
        throw new Error(`Invalid mandatory marking on mating ${m.id}: ${m.mandatoryMarking}`)
      }
      overrideMap.set(m.id, m.mandatoryMarking)
    }
  }

  // Track which combos are used (globally across this season's assignment)
  const usedCombos = new Set<string>()

  // Track which nose group is claimed by which mating
  const noseGroupOwner = new Map<NoseGroup, string>() // group → matingId

  // Available combos per group (mutable pool)
  const comboPool = new Map<NoseGroup, string[]>()
  for (const group of NOSE_PRIORITY) {
    comboPool.set(group, [...getCombosByGroup(group)])
  }

  const assignments = new Map<string, MarkingAssignment>()

  // --- Pass 1: process mandatory markings ---
  for (const mating of matings) {
    const mandatory = overrideMap.get(mating.id)
    if (!mandatory) continue

    const effectiveGroup = getNoseGroup(mandatory)

    // Claim the group
    if (!noseGroupOwner.has(effectiveGroup)) {
      noseGroupOwner.set(effectiveGroup, mating.id)
    } else if (noseGroupOwner.get(effectiveGroup) !== mating.id) {
      throw new Error(
        `Conflict: nose group ${effectiveGroup} already claimed by another mating`,
      )
    }

    usedCombos.add(mandatory)

    // Remove from pool
    const pool = comboPool.get(effectiveGroup)!
    const idx = pool.indexOf(mandatory)
    if (idx !== -1) pool.splice(idx, 1)

    // Assign hens
    const hens = assignHens(mating, mandatory, effectiveGroup, usedCombos, comboPool)
    assignments.set(mating.id, {
      matingId: mating.id,
      maleName: mating.maleName,
      noseGroup: effectiveGroup,
      hens,
    })
  }

  // --- Pass 2: assign remaining matings ---
  for (const mating of matings) {
    if (assignments.has(mating.id)) continue

    // Find the next available nose group
    let assignedGroup: NoseGroup | null = null
    for (const group of NOSE_PRIORITY) {
      if (!noseGroupOwner.has(group)) {
        noseGroupOwner.set(group, mating.id)
        assignedGroup = group
        break
      }
    }

    if (!assignedGroup) {
      // Overflow: use group with most remaining combos
      assignedGroup = findOverflowGroup(comboPool)
    }

    const hens = assignHens(mating, null, assignedGroup, usedCombos, comboPool)
    assignments.set(mating.id, {
      matingId: mating.id,
      maleName: mating.maleName,
      noseGroup: assignedGroup,
      hens,
    })
  }

  // Return in original mating order
  return matings.map((m) => assignments.get(m.id)!)
}

/**
 * Assign hen markings for a single mating.
 * Handles same/diff/single cases.
 */
function assignHens(
  mating: MatingInput,
  mandatoryCombo: string | null,
  group: NoseGroup,
  usedCombos: Set<string>,
  comboPool: Map<NoseGroup, string[]>,
): HenAssignment[] {
  const { henNames, sameMarking } = mating

  // Single hen — assign 1 combo
  if (henNames.length === 1) {
    const combo = mandatoryCombo ?? pickUnused(group, usedCombos, comboPool)
    usedCombos.add(combo)
    removeFromPool(group, combo, comboPool)
    return [{ henName: henNames[0]!, marking: combo }]
  }

  // Same marking — all hens share 1 combo
  if (sameMarking === true) {
    const combo = mandatoryCombo ?? pickUnused(group, usedCombos, comboPool)
    usedCombos.add(combo)
    removeFromPool(group, combo, comboPool)
    return henNames.map((name) => ({ henName: name, marking: combo }))
  }

  // Diff marking — 1 unique combo per hen
  const hens: HenAssignment[] = []
  if (mandatoryCombo) {
    // First hen gets the mandatory
    usedCombos.add(mandatoryCombo)
    removeFromPool(group, mandatoryCombo, comboPool)
    hens.push({ henName: henNames[0]!, marking: mandatoryCombo })
    for (let i = 1; i < henNames.length; i++) {
      const combo = pickUnused(group, usedCombos, comboPool)
      usedCombos.add(combo)
      removeFromPool(group, combo, comboPool)
      hens.push({ henName: henNames[i]!, marking: combo })
    }
  } else {
    for (const name of henNames) {
      const combo = pickUnused(group, usedCombos, comboPool)
      usedCombos.add(combo)
      removeFromPool(group, combo, comboPool)
      hens.push({ henName: name, marking: combo })
    }
  }
  return hens
}

// Bare nose-only combos — reserved for manual assignment, used as last resort only
const NOSE_ONLY = new Set(['LN', 'RN', 'DN'])

/**
 * Pick an unused combo from the given group's pool.
 * Prefers combos with feet marks; bare nose-only (LN/RN/DN) are last resort.
 * Throws if the group is exhausted.
 */
function pickUnused(
  group: NoseGroup,
  usedCombos: Set<string>,
  comboPool: Map<NoseGroup, string[]>,
): string {
  const pool = comboPool.get(group)!
  const available = pool.filter((c) => !usedCombos.has(c))
  if (available.length === 0) {
    throw new Error(`Combo pool for group ${group} is exhausted`)
  }
  // Prefer combos that include feet marks; only use bare nose-only as last resort
  const preferred = available.filter((c) => !NOSE_ONLY.has(c))
  return (preferred.length > 0 ? preferred : available)[0]!
}

/**
 * Remove a combo from the pool.
 */
function removeFromPool(
  group: NoseGroup,
  combo: string,
  comboPool: Map<NoseGroup, string[]>,
): void {
  const pool = comboPool.get(group)!
  const idx = pool.indexOf(combo)
  if (idx !== -1) pool.splice(idx, 1)
}

/**
 * Find the overflow group — the one with the most remaining combos.
 */
function findOverflowGroup(comboPool: Map<NoseGroup, string[]>): NoseGroup {
  let best: NoseGroup = 'NONE'
  let max = -1
  for (const [group, pool] of comboPool.entries()) {
    if (pool.length > max) {
      max = pool.length
      best = group
    }
  }
  return best
}
