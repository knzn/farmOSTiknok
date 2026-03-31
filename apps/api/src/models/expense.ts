import { Schema, model, type Document, type Types } from 'mongoose'

export type ExpenseCategory =
  | 'feeds'
  | 'vitamins'
  | 'medicines'
  | 'deworming'
  | 'workers_extra_budget'
  | 'miscellaneous'

export type ExpenseType = 'unit' | 'direct'

// Category → type mapping (authoritative — frontend and backend must use this)
export const CATEGORY_TYPE_MAP: Record<ExpenseCategory, ExpenseType> = {
  feeds:                 'unit',
  vitamins:              'unit',
  medicines:             'unit',
  deworming:             'unit',
  workers_extra_budget:  'direct',
  miscellaneous:         'direct',
}

export const UNIT_OPTIONS_FEEDS    = ['Kilo', 'Sacks'] as const
export const UNIT_OPTIONS_MED      = ['Kilo', 'Box', 'Sachet', '100mL', '10mL', 'Tablet/Capsule'] as const

export interface IFarmExpense extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId

  category: ExpenseCategory
  type: ExpenseType        // always derived from category via CATEGORY_TYPE_MAP, stored for fast reads

  // Date — purchase date set by user
  date: Date
  month: number            // 1–12, derived from date
  year: number             // derived from date

  // type: 'unit' fields
  name: string | null
  unit: string | null
  quantity: number | null
  pricePerUnit: number | null
  totalAmount: number      // backend-computed: quantity * pricePerUnit (or = amount for direct)

  // type: 'direct' fields
  description: string | null   // miscellaneous only
  amount: number | null        // workers_extra_budget and miscellaneous

  // Shared optional
  receiptUrl: string | null
  notes: string | null

  // Accounting integrity
  locked: boolean
  lockedAt: Date | null

  createdAt: Date
  updatedAt: Date
}

const ExpenseSchema = new Schema<IFarmExpense>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      required: true,
      enum: ['feeds', 'vitamins', 'medicines', 'deworming', 'workers_extra_budget', 'miscellaneous'],
    },
    type: {
      type: String,
      required: true,
      enum: ['unit', 'direct'],
    },

    date:  { type: Date, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year:  { type: Number, required: true },

    // unit fields
    name:         { type: String, default: null, trim: true },
    unit:         { type: String, default: null },
    quantity:     { type: Number, default: null, min: 0 },
    pricePerUnit: { type: Number, default: null, min: 0 },
    totalAmount:  { type: Number, required: true, min: 0, default: 0 },

    // direct fields
    description: { type: String, default: null, trim: true },
    amount:      { type: Number, default: null, min: 0 },

    // shared optional
    receiptUrl: { type: String, default: null },
    notes:      { type: String, default: null, trim: true },

    // accounting
    locked:   { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// Compound indexes for fast queries
ExpenseSchema.index({ userId: 1, year: 1, month: 1 })
ExpenseSchema.index({ userId: 1, year: 1 })

export const FarmExpense = model<IFarmExpense>('FarmExpense', ExpenseSchema)
