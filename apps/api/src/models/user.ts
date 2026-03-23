import { Schema, model, type Document, type Types } from 'mongoose'

export interface IUser extends Document {
  _id: Types.ObjectId
  username: string
  email: string
  passwordHash: string
  profilePhoto: string | null
  coverPhoto: string | null
  bio: string
  location: string
  isBreeder: boolean
  followers: Types.ObjectId[]
  following: Types.ObjectId[]
  refreshToken: string | null
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
    passwordHash: { type: String, required: true },
    profilePhoto: { type: String, default: null },
    coverPhoto: { type: String, default: null },
    bio: { type: String, default: '', maxlength: 150 },
    location: { type: String, default: '' },
    isBreeder: { type: Boolean, default: false },
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    refreshToken: { type: String, default: null },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', UserSchema)
