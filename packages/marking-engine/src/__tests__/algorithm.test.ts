import { describe, it, expect } from 'vitest'
import { generateMarkings } from '../algorithm.js'
import { getNoseGroup } from '../validate.js'
import type { MatingInput } from '../types.js'

function makeMating(overrides: Partial<MatingInput> & { id: string; maleName: string }): MatingInput {
  return {
    henCount: 1,
    henNames: ['Hen 1'],
    sameMarking: null,
    mandatoryMarking: null,
    ...overrides,
  }
}

describe('generateMarkings — basic assignment', () => {
  it('assigns first mating to LN group', () => {
    const matings = [makeMating({ id: '1', maleName: 'Raptor' })]
    const result = generateMarkings(matings)
    expect(result[0]!.noseGroup).toBe('LN')
    expect(result[0]!.hens.length).toBe(1)
    expect(result[0]!.hens[0]!.marking.startsWith('LN')).toBe(true)
  })

  it('assigns second mating to RN group', () => {
    const matings = [
      makeMating({ id: '1', maleName: 'A' }),
      makeMating({ id: '2', maleName: 'B' }),
    ]
    const result = generateMarkings(matings)
    expect(result[0]!.noseGroup).toBe('LN')
    expect(result[1]!.noseGroup).toBe('RN')
  })

  it('assigns 4 matings to 4 groups in priority order', () => {
    const matings = ['A', 'B', 'C', 'D'].map((name, i) =>
      makeMating({ id: String(i), maleName: name }),
    )
    const result = generateMarkings(matings)
    const groups = result.map(r => r.noseGroup)
    expect(groups).toEqual(['LN', 'RN', 'DN', 'NONE'])
  })

  it('returns empty array for empty input', () => {
    expect(generateMarkings([])).toEqual([])
  })
})

describe('generateMarkings — same vs diff marking', () => {
  it('same-marking mating: all hens get the same combo', () => {
    const m = makeMating({
      id: '1',
      maleName: 'Grey',
      henCount: 3,
      henNames: ['Hen A', 'Hen B', 'Hen C'],
      sameMarking: true,
    })
    const result = generateMarkings([m])
    const markings = result[0]!.hens.map(h => h.marking)
    expect(new Set(markings).size).toBe(1)
  })

  it('diff-marking mating: each hen gets a unique combo', () => {
    const m = makeMating({
      id: '1',
      maleName: 'Hatch',
      henCount: 4,
      henNames: ['H1', 'H2', 'H3', 'H4'],
      sameMarking: false,
    })
    const result = generateMarkings([m])
    const markings = result[0]!.hens.map(h => h.marking)
    expect(new Set(markings).size).toBe(4)
  })
})

describe('generateMarkings — mandatory markings', () => {
  it('diff-marking mating with mandatory: first hen gets mandatory, rest get unique combos', () => {
    const m = makeMating({
      id: '1',
      maleName: 'Hatch',
      henCount: 3,
      henNames: ['H1', 'H2', 'H3'],
      sameMarking: false,
      mandatoryMarking: 'LN-RI',
    })
    const result = generateMarkings([m])
    expect(result[0]!.hens[0]!.marking).toBe('LN-RI')
    // All markings unique
    const markings = result[0]!.hens.map(h => h.marking)
    expect(new Set(markings).size).toBe(3)
    // All in LN group
    expect(result[0]!.noseGroup).toBe('LN')
  })

  it('throws when two matings both have mandatory markings in the same nose group', () => {
    const matings = [
      makeMating({ id: '1', maleName: 'A', mandatoryMarking: 'LN-LO' }),
      makeMating({ id: '2', maleName: 'B', mandatoryMarking: 'LN-RI' }),
    ]
    expect(() => generateMarkings(matings)).toThrow()
  })

  it('respects mandatory marking on the mating itself', () => {
    const m = makeMating({
      id: '1',
      maleName: 'Kelso',
      mandatoryMarking: 'RN-LO',
    })
    const result = generateMarkings([m])
    // Should be assigned to RN group (because RN-LO is an RN combo)
    expect(result[0]!.noseGroup).toBe('RN')
    expect(result[0]!.hens[0]!.marking).toBe('RN-LO')
  })

  it('mandatory override takes priority over mating mandatory', () => {
    const m = makeMating({
      id: '1',
      maleName: 'Sweater',
      mandatoryMarking: 'LN-RI',
    })
    const result = generateMarkings([m], [{ matingId: '1', marking: 'DN-LO' }])
    expect(result[0]!.hens[0]!.marking).toBe('DN-LO')
    expect(result[0]!.noseGroup).toBe('DN')
  })

  it('throws on invalid mandatory override combo', () => {
    const m = makeMating({ id: '1', maleName: 'X' })
    expect(() =>
      generateMarkings([m], [{ matingId: '1', marking: 'GARBAGE' }]),
    ).toThrow(/Invalid mandatory marking/)
  })

  it('throws on invalid mandatory marking on the mating itself', () => {
    const m = makeMating({ id: '1', maleName: 'X', mandatoryMarking: 'INVALID' })
    expect(() => generateMarkings([m])).toThrow()
  })

  it('does not throw when overrides list is non-empty but no matings match', () => {
    // No matings → returns [] immediately, overrides never processed
    expect(() =>
      generateMarkings([], [{ matingId: '1', marking: 'GARBAGE' }]),
    ).not.toThrow()
  })
})

describe('generateMarkings — no cross-group contamination', () => {
  it('LN mating never gets an RN combo', () => {
    const matings = [makeMating({ id: '1', maleName: 'A' })]
    const result = generateMarkings(matings)
    expect(result[0]!.hens.every(h => getNoseGroup(h.marking) === 'LN')).toBe(true)
  })

  it('all combos across matings are unique', () => {
    const matings = ['A', 'B', 'C', 'D'].map((name, i) =>
      makeMating({
        id: String(i),
        maleName: name,
        henCount: 2,
        henNames: ['H1', 'H2'],
        sameMarking: false,
      }),
    )
    const result = generateMarkings(matings)
    const allMarkings = result.flatMap(r => r.hens.map(h => h.marking))
    expect(new Set(allMarkings).size).toBe(allMarkings.length)
  })
})

describe('generateMarkings — pool exhaustion', () => {
  it('throws when a single mating needs more diff combos than available in its group', () => {
    // Each group has 24 combos. Request 25 diff hens from a single group.
    const henNames = Array.from({ length: 25 }, (_, i) => `Hen ${i + 1}`)
    const m = makeMating({
      id: '1',
      maleName: 'Overflow Test',
      henCount: 25,
      henNames,
      sameMarking: false,
    })
    expect(() => generateMarkings([m])).toThrow(/exhausted/)
  })
})

describe('generateMarkings — overflow (5th mating+)', () => {
  it('5th mating goes to overflow (reuses a group)', () => {
    const matings = ['A', 'B', 'C', 'D', 'E'].map((name, i) =>
      makeMating({ id: String(i), maleName: name }),
    )
    const result = generateMarkings(matings)
    // First 4 get LN/RN/DN/NONE, 5th must borrow from one of them
    const fifthGroup = result[4]!.noseGroup
    expect(['LN', 'RN', 'DN', 'NONE']).toContain(fifthGroup)
  })
})

describe('generateMarkings — single hen mating', () => {
  it('single hen: no same/diff prompt, consumes exactly 1 combo slot', () => {
    const m = makeMating({
      id: '1',
      maleName: 'Solo',
      henCount: 1,
      henNames: ['Only Hen'],
      sameMarking: null, // explicitly null — no same/diff prompt
    })
    const result = generateMarkings([m])
    expect(result[0]!.hens.length).toBe(1)
    expect(result[0]!.hens[0]!.henName).toBe('Only Hen')
    expect(typeof result[0]!.hens[0]!.marking).toBe('string')
    expect(result[0]!.hens[0]!.marking.length).toBeGreaterThan(0)
  })

  it('single hen marking starts with the correct nose group prefix', () => {
    // First mating gets LN → single hen should get an LN combo
    const m = makeMating({ id: '1', maleName: 'Solo', sameMarking: null })
    const result = generateMarkings([m])
    expect(result[0]!.noseGroup).toBe('LN')
    expect(getNoseGroup(result[0]!.hens[0]!.marking)).toBe('LN')
  })
})

describe('generateMarkings — full season simulation', () => {
  it('4-mating season: all markings are unique, each in correct group', () => {
    const matings: MatingInput[] = [
      makeMating({ id: '1', maleName: 'Raptor Sweater', henCount: 5, henNames: ['H1','H2','H3','H4','H5'], sameMarking: false }),
      makeMating({ id: '2', maleName: 'Grey Lemon', henCount: 3, henNames: ['H1','H2','H3'], sameMarking: false }),
      makeMating({ id: '3', maleName: 'Hatch', henCount: 1, henNames: ['H1'], sameMarking: null }),
      makeMating({ id: '4', maleName: 'Kelso', henCount: 4, henNames: ['H1','H2','H3','H4'], sameMarking: false }),
    ]
    const result = generateMarkings(matings)

    expect(result[0]!.noseGroup).toBe('LN')
    expect(result[1]!.noseGroup).toBe('RN')
    expect(result[2]!.noseGroup).toBe('DN')
    expect(result[3]!.noseGroup).toBe('NONE')

    const allMarkings = result.flatMap(r => r.hens.map(h => h.marking))
    expect(allMarkings.length).toBe(13) // 5+3+1+4

    // All markings globally unique
    expect(new Set(allMarkings).size).toBe(13)

    // Each marking belongs to its mating's nose group
    for (const assignment of result) {
      for (const hen of assignment.hens) {
        expect(getNoseGroup(hen.marking)).toBe(assignment.noseGroup)
      }
    }
  })

  it('6-mating season: overflow matings have no duplicate combos', () => {
    const matings: MatingInput[] = [
      makeMating({ id: '1', maleName: 'A', henCount: 2, henNames: ['H1','H2'], sameMarking: false }),
      makeMating({ id: '2', maleName: 'B', henCount: 2, henNames: ['H1','H2'], sameMarking: false }),
      makeMating({ id: '3', maleName: 'C', henCount: 2, henNames: ['H1','H2'], sameMarking: false }),
      makeMating({ id: '4', maleName: 'D', henCount: 2, henNames: ['H1','H2'], sameMarking: false }),
      makeMating({ id: '5', maleName: 'E', henCount: 1, henNames: ['H1'], sameMarking: null }), // overflow
      makeMating({ id: '6', maleName: 'F', henCount: 1, henNames: ['H1'], sameMarking: null }), // overflow
    ]
    const result = generateMarkings(matings)

    // First 4 matings claim all 4 groups
    const groups = result.slice(0, 4).map(r => r.noseGroup)
    expect(new Set(groups).size).toBe(4)

    // Overflow matings (5 & 6) are in a valid group
    expect(['LN', 'RN', 'DN', 'NONE']).toContain(result[4]!.noseGroup)
    expect(['LN', 'RN', 'DN', 'NONE']).toContain(result[5]!.noseGroup)

    // No duplicate markings across the entire season
    const allMarkings = result.flatMap(r => r.hens.map(h => h.marking))
    expect(new Set(allMarkings).size).toBe(allMarkings.length)
  })
})
