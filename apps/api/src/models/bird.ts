import { Schema, model, type Document, type Types } from 'mongoose'

export type BirdCategory = 'stag' | 'cock' | 'pullet' | 'brood_hen' | 'chick'
export type BirdStatus = 'active' | 'retired' | 'sold' | 'deceased'

export interface IBird extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  name: string
  bloodline: string | null
  marking: string | null
  matingId: Types.ObjectId | null
  category: BirdCategory
  status: BirdStatus
  birthDate: Date | null
  weight: number | null   // grams
  notes: string | null
  photoUrl: string | null
  parentMaleId: Types.ObjectId | null
  parentFemaleId: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const BirdSchema = new Schema<IBird>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    bloodline: { type: String, default: null, trim: true },
    marking: { type: String, default: null, trim: true },
    matingId: { type: Schema.Types.ObjectId, ref: 'Mating', default: null },
    category: { type: String, required: true, enum: ['stag', 'cock', 'pullet', 'brood_hen', 'chick'] },
    status: { type: String, required: true, enum: ['active', 'retired', 'sold', 'deceased'], default: 'active' },
    birthDate: { type: Date, default: null },
    weight: { type: Number, default: null },
    notes: { type: String, default: null },
    photoUrl: { type: String, default: null },
    parentMaleId: { type: Schema.Types.ObjectId, ref: 'Bird', default: null },
    parentFemaleId: { type: Schema.Types.ObjectId, ref: 'Bird', default: null },
  },
  { timestamps: true },
)

BirdSchema.index({ userId: 1, category: 1 })
BirdSchema.index({ userId: 1, status: 1 })
BirdSchema.index({ userId: 1, createdAt: -1 })

export const Bird = model<IBird>('Bird', BirdSchema)
