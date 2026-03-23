import { describe, it, expect } from 'vitest'
import { validateMarking, isValidCombo } from '../validate.js'

describe('validateMarking', () => {
  it('validates known-good combos', () => {
    expect(validateMarking('DL')).toEqual({ valid: true, errors: [] })
    expect(validateMarking('LN-RI')).toEqual({ valid: true, errors: [] })
    expect(validateMarking('DN-OO-II')).toEqual({ valid: true, errors: [] })
  })

  it('rejects invalid combo strings', () => {
    const result = validateMarking('LO-DL')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects empty string', () => {
    const result = validateMarking('')
    expect(result.valid).toBe(false)
  })

  it('rejects made-up codes', () => {
    expect(validateMarking('ZZ-QQ').valid).toBe(false)
  })
})

describe('isValidCombo', () => {
  it('returns true for valid combos', () => {
    expect(isValidCombo('DL')).toBe(true)
    expect(isValidCombo('RN-DL')).toBe(true)
  })

  it('returns false for invalid combos', () => {
    expect(isValidCombo('LO-DL')).toBe(false)
    expect(isValidCombo('GARBAGE')).toBe(false)
  })
})
