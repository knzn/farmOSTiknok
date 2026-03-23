import { Schema, model, type Document, type Types } from 'mongoose'

export interface IFeedProgram extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  gramsPerFeeding: number
  feedingsPerDay: number
  fastingDaysPerWeek: number
  costPerKg: number
  currency: string
  updatedAt: Date
}

const FeedProgramSchema = new Schema<IFeedProgram>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    gramsPerFeeding: { type: Number, required: true, min: 1 },
    feedingsPerDay: { type: Number, required: true, enum: [1, 2] },
    fastingDaysPerWeek: { type: Number, default: 0, min: 0, max: 7 },
    costPerKg: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'PHP' },
  },
  { timestamps: true },
)

export const FeedProgram = model<IFeedProgram>('FeedProgram', FeedProgramSchema)
