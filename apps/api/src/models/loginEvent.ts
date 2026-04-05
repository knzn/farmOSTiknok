import { Schema, model, type Document, type Types } from 'mongoose'

export interface ILoginEvent extends Document {
  userId: Types.ObjectId
  ip: string | null
  userAgent: string | null
  method: 'local' | 'google'     // which auth method was used
  success: boolean
  createdAt: Date
}

const LoginEventSchema = new Schema<ILoginEvent>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ip:        { type: String, default: null },
    userAgent: { type: String, default: null },
    method:    { type: String, enum: ['local', 'google'], default: 'local' },
    success:   { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

LoginEventSchema.index({ userId: 1, createdAt: -1 })

export const LoginEvent = model<ILoginEvent>('LoginEvent', LoginEventSchema)
