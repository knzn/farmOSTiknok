import { getAllValidCombos, getNoseGroup } from './combos.js'
import type { ValidationResult } from './types.js'

/**
 * Validate a marking combo string.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
export function validateMarking(marking: string): ValidationResult {
  if (!marking || typeof marking !== 'string') {
    return { valid: false, errors: ['Marking must be a non-empty string'] }
  }

  const valid = getAllValidCombos().includes(marking)
  if (!valid) {
    return {
      valid: false,
      errors: [`"${marking}" is not a valid marking combination`],
    }
  }

  return { valid: true, errors: [] }
}

/**
 * Returns true if the combo string is in the valid combos list.
 */
export function isValidCombo(combo: string): boolean {
  return getAllValidCombos().includes(combo)
}

export { getNoseGroup }
