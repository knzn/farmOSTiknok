export type NoseGroup = 'LN' | 'RN' | 'DN' | 'NONE' | 'OVERFLOW'

export interface MatingInput {
  id: string
  maleName: string
  henCount: number
  henNames: string[]
  sameMarking: boolean | null
  mandatoryMarking: string | null
}

export interface MandatoryOverride {
  matingId: string
  marking: string
}

export interface HenAssignment {
  henName: string
  marking: string
}

export interface MarkingAssignment {
  matingId: string
  maleName: string
  noseGroup: NoseGroup
  hens: HenAssignment[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}
