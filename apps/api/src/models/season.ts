import { Schema, model, type Document, type Types } from 'mongoose'

export interface ISeason extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  name: string
  year: number
  markingsGenerated: boolean
  generatedAt: Date | null
  // Breeding lifecycle
  eggsLaid: number | null
  expectedHatchDate: Date | null
  chicksHatched: number | null
  hatchRate: number | null
  maleCount: number | null
  femaleCount: number | null
  sexCountDone: boolean
  sexCountUpdatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const SeasonSchema = new Schema<ISeason>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    markingsGenerated: { type: Boolean, default: false },
    generatedAt: { type: Date, default: null },
    // Breeding lifecycle
    eggsLaid: { type: Number, default: null },
    expectedHatchDate: { type: Date, default: null },
    chicksHatched: { type: Number, default: null },
    hatchRate: { type: Number, default: null },
    maleCount: { type: Number, default: null },
    femaleCount: { type: Number, default: null },
    sexCountDone: { type: Boolean, default: false },
    sexCountUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// Compound index so listing seasons by user is fast
SeasonSchema.index({ userId: 1, createdAt: -1 })

export const Season = model<ISeason>('Season', SeasonSchema)
