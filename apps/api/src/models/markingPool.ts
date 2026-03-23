import { Schema, model, type Document, type Types } from 'mongoose'

export interface IPoolAssignment {
  matingId: Types.ObjectId
  maleName: string
  noseGroup: string
  combos: string[]
}

export interface IMarkingPool extends Document {
  _id: Types.ObjectId
  seasonId: Types.ObjectId
  userId: Types.ObjectId
  assignments: IPoolAssignment[]
  usedCombos: string[]
  generatedAt: Date
}

const MarkingPoolSchema = new Schema<IMarkingPool>(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignments: [
      {
        matingId: { type: Schema.Types.ObjectId, ref: 'Mating', required: true },
        maleName: { type: String, required: true },
        noseGroup: { type: String, required: true },
        combos: [{ type: String }],
      },
    ],
    usedCombos: [{ type: String }],
    generatedAt: { type: Date, required: true },
  },
  { timestamps: false },
)

export const MarkingPool = model<IMarkingPool>('MarkingPool', MarkingPoolSchema)
