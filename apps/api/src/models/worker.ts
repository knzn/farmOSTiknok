import { Schema, model, type Document, type Types } from 'mongoose'

export const POSITION_PRESETS = [
  'Farm Manager',
  'Handler',
  'Assistant Handler',
  'Breeder',
  'Assistant Breeder',
  'Farm Buddy',
] as const

export interface IAdvance {
  _id: Types.ObjectId
  amount: number
  reason: string | null
  date: Date
  month: number  // 1–12
  year: number
  createdAt: Date
}

export interface IPayment {
  _id: Types.ObjectId
  month: number
  year: number
  grossSalary: number
  totalAdvances: number
  netPay: number
  paidAt: Date
}

export interface IWorker extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId

  // Required
  name: string
  position: string
  monthlySalary: number
  salaryDay: number   // 1–31, day of month salary is due

  // Optional profile
  photo: string | null
  address: string | null
  phoneNumber: string | null
  fbLink: string | null

  advances: IAdvance[]
  payments: IPayment[]

  createdAt: Date
  updatedAt: Date
}

const AdvanceSchema = new Schema<IAdvance>(
  {
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, default: null, trim: true },
    date: { type: Date, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
)

const PaymentSchema = new Schema<IPayment>(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    grossSalary: { type: Number, required: true },
    totalAdvances: { type: Number, required: true },
    netPay: { type: Number, required: true },
    paidAt: { type: Date, required: true },
  },
  { _id: true },
)

const WorkerSchema = new Schema<IWorker>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    monthlySalary: { type: Number, required: true, min: 0 },
    salaryDay: { type: Number, required: true, min: 1, max: 31, default: 30 },
    photo: { type: String, default: null },
    address: { type: String, default: null, trim: true },
    phoneNumber: { type: String, default: null, trim: true },
    fbLink: { type: String, default: null, trim: true },
    advances: [AdvanceSchema],
    payments: [PaymentSchema],
  },
  { timestamps: true },
)

export const Worker = model<IWorker>('Worker', WorkerSchema)
