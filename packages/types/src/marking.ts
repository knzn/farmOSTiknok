import { z } from 'zod'

export const NoseMarkSchema = z.enum(['LN', 'RN', 'DN'])
export type NoseMark = z.infer<typeof NoseMarkSchema>

export const FeetMarkSchema = z.enum(['LO', 'RO', 'LI', 'RI', 'DL', 'DR', 'OO', 'II'])
export type FeetMark = z.infer<typeof FeetMarkSchema>

export const NoseGroupSchema = z.enum(['LN', 'RN', 'DN', 'NONE', 'OVERFLOW'])
export type NoseGroup = z.infer<typeof NoseGroupSchema>

export const MatingInputSchema = z.object({
  id: z.string(),
  maleName: z.string().min(1),
  henCount: z.number().int().min(1),
  henNames: z.array(z.string().min(1)),
  sameMarking: z.boolean().nullable(),
  mandatoryMarking: z.string().nullable(),
})
export type MatingInput = z.infer<typeof MatingInputSchema>

export const MandatoryOverrideSchema = z.object({
  matingId: z.string(),
  marking: z.string(),
})
export type MandatoryOverride = z.infer<typeof MandatoryOverrideSchema>

export const HenAssignmentSchema = z.object({
  henName: z.string(),
  marking: z.string(),
})
export type HenAssignment = z.infer<typeof HenAssignmentSchema>

export const MarkingAssignmentSchema = z.object({
  matingId: z.string(),
  maleName: z.string(),
  noseGroup: NoseGroupSchema,
  hens: z.array(HenAssignmentSchema),
})
export type MarkingAssignment = z.infer<typeof MarkingAssignmentSchema>

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
})
export type ValidationResult = z.infer<typeof ValidationResultSchema>
