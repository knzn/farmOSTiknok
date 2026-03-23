import { z } from 'zod'

export const SeasonTypeSchema = z.enum([
  'Early Bird',
  'Local',
  'National',
  'Late Born',
  'Off Season',
  'Others',
])
export type SeasonType = z.infer<typeof SeasonTypeSchema>

export const CreateSeasonInputSchema = z.object({
  name: z.union([SeasonTypeSchema, z.string().min(1).max(100)]),
  year: z.number().int().min(2000).max(2100),
})
export type CreateSeasonInput = z.infer<typeof CreateSeasonInputSchema>

export const CreateMatingInputSchema = z.object({
  maleName: z.string().min(1).max(100),
  henCount: z.number().int().min(1),
  henNames: z.array(z.string().min(1).max(100)),
  sameMarking: z.boolean().nullable(),
  mandatoryMarking: z.string().nullable(),
})
export type CreateMatingInput = z.infer<typeof CreateMatingInputSchema>

export const GenerateConfirmInputSchema = z.object({
  assignments: z.array(
    z.object({
      matingId: z.string(),
      noseGroup: z.enum(['LN', 'RN', 'DN', 'NONE', 'OVERFLOW']),
      hens: z.array(
        z.object({
          henName: z.string(),
          marking: z.string(),
        }),
      ),
    }),
  ),
})
export type GenerateConfirmInput = z.infer<typeof GenerateConfirmInputSchema>
