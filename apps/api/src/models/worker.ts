import { Schema, model, type Document, type Types } from 'mongoose'

export interface IWorker extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  name: string
  role: string | null
  payType: 'daily' | 'monthly'
  payAmount: number
  currency: string
  isActive: boolean
  notes: string | null
  createdAt: Date
}

const WorkerSchema = new Schema<IWorker>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: null, trim: true },
    payType: { type: String, enum: ['daily', 'monthly'], required: true },
    payAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'PHP' },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: true },
)

WorkerSchema.index({ userId: 1, isActive: 1 })

export const Worker = model<IWorker>('Worker', WorkerSchema)
