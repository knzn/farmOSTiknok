import { Schema, model, type Document, type Types } from 'mongoose'

export interface IFightRecord extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  stagName: string
  bloodline: string | null
  marking: string | null
  matingId: Types.ObjectId | null
  derbyEventId: Types.ObjectId | null
  result: 'win' | 'loss' | 'draw' | 'cancelled'
  weightClass: string | null
  fightDate: Date
  notes: string | null
  createdAt: Date
}

const FightRecordSchema = new Schema<IFightRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    stagName: { type: String, required: true, trim: true },
    bloodline: { type: String, default: null, trim: true },
    marking: { type: String, default: null, trim: true },
    matingId: { type: Schema.Types.ObjectId, ref: 'Mating', default: null },
    derbyEventId: { type: Schema.Types.ObjectId, default: null },
    result: { type: String, enum: ['win', 'loss', 'draw', 'cancelled'], required: true },
    weightClass: { type: String, default: null, trim: true },
    fightDate: { type: Date, required: true },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: true },
)

FightRecordSchema.index({ userId: 1, fightDate: -1 })
FightRecordSchema.index({ userId: 1, result: 1 })

export const FightRecord = model<IFightRecord>('FightRecord', FightRecordSchema)
