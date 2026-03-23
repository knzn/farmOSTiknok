import { z } from 'zod'

export const RegisterInputSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, 'Username must be lowercase alphanumeric + underscore only'),
  email: z.string().email(),
  password: z.string().min(8),
})
export type RegisterInput = z.infer<typeof RegisterInputSchema>

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const UserProfileSchema = z.object({
  _id: z.string(),
  username: z.string(),
  email: z.string().email(),
  profilePhoto: z.string().nullable(),
  bio: z.string().max(150),
  location: z.string(),
  isBreeder: z.boolean(),
  followersCount: z.number(),
  followingCount: z.number(),
  createdAt: z.string().datetime(),
})
export type UserProfile = z.infer<typeof UserProfileSchema>
