import { Schema, model, type Document, type Types } from 'mongoose'

export interface IFarmInventory extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  stags: number
  pullets: number
  broodHens: number
  chicks: number
  cocks: number
  notes: string | null
  updatedAt: Date
}

const FarmInventorySchema = new Schema<IFarmInventory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    stags: { type: Number, default: 0, min: 0 },
    pullets: { type: Number, default: 0, min: 0 },
    broodHens: { type: Number, default: 0, min: 0 },
    chicks: { type: Number, default: 0, min: 0 },
    cocks: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: true },
)

export const FarmInventory = model<IFarmInventory>('FarmInventory', FarmInventorySchema)
