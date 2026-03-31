import { Schema, model, type Document, type Types } from 'mongoose'

export interface IHen {
  _id: Types.ObjectId
  henName: string
  marking: string | null
  previousMarking: string | null
  photo: string | null
  eggsLaid: number | null
  chicksHatched: number | null
  maleCount: number | null
  femaleCount: number | null
}

export interface IMating extends Document {
  _id: Types.ObjectId
  seasonId: Types.ObjectId
  userId: Types.ObjectId
  maleName: string
  noseGroup: 'LN' | 'RN' | 'DN' | 'NONE' | 'OVERFLOW' | null
  sameMarking: boolean | null
  mandatoryMarking: string | null
  hens: IHen[]
  // Breeding lifecycle — per-mating/pen tracking
  useIndividualHenCount: boolean   // true = per-hen, false = pen total
  penEggsLaid: number | null
  penChicksHatched: number | null
  penMaleCount: number | null
  penFemaleCount: number | null
  malePhoto: string | null
  createdAt: Date
  updatedAt: Date
}

const HenSchema = new Schema<IHen>(
  {
    henName: { type: String, required: true, trim: true },
    marking: { type: String, default: null },
    previousMarking: { type: String, default: null },
    photo: { type: String, default: null },
    eggsLaid: { type: Number, default: null },
    chicksHatched: { type: Number, default: null },
    maleCount: { type: Number, default: null },
    femaleCount: { type: Number, default: null },
  },
  { _id: true },
)

const MatingSchema = new Schema<IMating>(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    maleName: { type: String, required: true, trim: true },
    noseGroup: {
      type: String,
      enum: ['LN', 'RN', 'DN', 'NONE', 'OVERFLOW', null],
      default: null,
    },
    sameMarking: { type: Boolean, default: null },
    mandatoryMarking: { type: String, default: null },
    hens: [HenSchema],
    useIndividualHenCount: { type: Boolean, default: false },
    penEggsLaid: { type: Number, default: null },
    penChicksHatched: { type: Number, default: null },
    penMaleCount: { type: Number, default: null },
    penFemaleCount: { type: Number, default: null },
    malePhoto: { type: String, default: null },
  },
  { timestamps: true },
)

MatingSchema.index({ seasonId: 1, userId: 1 })

export const Mating = model<IMating>('Mating', MatingSchema)
