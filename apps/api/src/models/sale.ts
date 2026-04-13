import { Schema, model, type Document, type Types } from 'mongoose'

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export interface IFarmSale extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId

  description: string       // "Boss Dong - 20 stags, 30 pullets, 5 chicks"
  amount: number            // total deal price

  date: Date
  month: number             // 1–12, derived from date
  year: number              // derived from date

  paymentStatus: PaymentStatus   // default: 'paid'
  notes: string | null

  createdAt: Date
  updatedAt: Date
}

const SaleSchema = new Schema<IFarmSale>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    amount:      { type: Number, required: true, min: 0 },
    date:        { type: Date, required: true },
    month:       { type: Number, required: true, min: 1, max: 12 },
    year:        { type: Number, required: true },
    paymentStatus: {
      type:    String,
      required: true,
      enum:    ['paid', 'partial', 'unpaid'],
      default: 'paid',
    },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: true },
)

// Fast queries by month/year
SaleSchema.index({ userId: 1, year: 1, month: 1 })
SaleSchema.index({ userId: 1, year: 1 })

export const FarmSale = model<IFarmSale>('FarmSale', SaleSchema)
