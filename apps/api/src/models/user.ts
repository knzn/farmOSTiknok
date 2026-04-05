import { Schema, model, type Document, type Types } from 'mongoose'

export interface IUser extends Document {
  _id: Types.ObjectId
  username: string
  email: string
  passwordHash: string | null           // null for social-only accounts

  // ── social auth ───────────────────────────────────────────────────────────
  googleId: string | null
  authProviders: string[]               // ['local'] | ['google'] | combinations
  profilePhoto: string | null
  coverPhoto: string | null
  bio: string
  location: string
  isBreeder: boolean
  followers: Types.ObjectId[]
  following: Types.ObjectId[]
  refreshToken: string | null

  // ── subscription ──────────────────────────────────────────────────────────
  tiknokId: string                          // TK-XXXXX — public user ID
  isAdmin: boolean                          // admin/moderator flag
  subscriptionTier: 'free' | 'pro'         // current tier
  trialEndsAt: Date                         // register date + 60 days
  paidUntil: Date | null                    // last activated until date
  dataDeletesAt: Date | null                // paidUntil + 6 months (set when expired)
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended'
  expoPushToken: string | null              // Expo push notification token

  // ── ban ───────────────────────────────────────────────────────────────────
  isBanned: boolean
  banReason: string | null
  bannedAt: Date | null

  // ── account security ──────────────────────────────────────────────────────
  mobileNumber: string | null               // optional, for account recovery
  accountSecuredAt: Date | null             // set when social user adds password

  // ── password reset ────────────────────────────────────────────────────────
  resetToken: string | null                 // SHA-256 hash of the plain token sent in email
  resetTokenExpiresAt: Date | null          // 1 hour from request

  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_]+$/,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, default: null },

    // ── social auth ──────────────────────────────────────────────────────────
    googleId:      { type: String, default: null, sparse: true },
    authProviders: { type: [String], default: ['local'] },
    profilePhoto: { type: String, default: null },
    coverPhoto: { type: String, default: null },
    bio: { type: String, default: '', maxlength: 150 },
    location: { type: String, default: '' },
    isBreeder: { type: Boolean, default: false },
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    refreshToken: { type: String, default: null },

    // ── subscription ────────────────────────────────────────────────────────
    tiknokId: {
      type: String,
      unique: true,
      sparse: true,          // allows null during migration, enforced on new users
    },
    isAdmin: { type: Boolean, default: false },
    subscriptionTier: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    trialEndsAt: { type: Date, default: null },
    paidUntil: { type: Date, default: null },
    dataDeletesAt: { type: Date, default: null },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'expired', 'suspended'],
      default: 'trial',
    },
    expoPushToken: { type: String, default: null },
    isBanned:   { type: Boolean, default: false },
    banReason:  { type: String, default: null },
    bannedAt:   { type: Date, default: null },
    mobileNumber:     { type: String, default: null },
    accountSecuredAt: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// ── indexes ───────────────────────────────────────────────────────────────────
UserSchema.index({ subscriptionStatus: 1 })
UserSchema.index({ trialEndsAt: 1 })
UserSchema.index({ dataDeletesAt: 1 })
// tiknokId, googleId indexes are declared inline via unique/sparse on the field

export const User = model<IUser>('User', UserSchema)
