import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { FarmSale } from '../models/sale.js'
import type { JwtPayload } from '../plugins/auth.js'

function uid(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: 'Not Found', message: 'Sale not found', statusCode: 404 })
}

function serializeSale(s: InstanceType<typeof FarmSale>) {
  return {
    id:            s._id,
    description:   s.description,
    amount:        s.amount,
    date:          s.date,
    month:         s.month,
    year:          s.year,
    paymentStatus: s.paymentStatus,
    notes:         s.notes ?? null,
    createdAt:     s.createdAt,
    updatedAt:     s.updatedAt,
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

const CreateSaleSchema = z.object({
  description:   z.string().min(1).max(500).trim(),
  amount:        z.number().min(0),
  date:          z.string().min(1),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).default('paid'),
  notes:         z.string().max(500).trim().nullable().optional(),
})

const UpdateSaleSchema = z.object({
  description:   z.string().min(1).max(500).trim().optional(),
  amount:        z.number().min(0).optional(),
  date:          z.string().min(1).optional(),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).optional(),
  notes:         z.string().max(500).trim().nullable().optional(),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function saleRoutes(fastify: FastifyInstance) {
  // ── GET /api/sales/summary ────────────────────────────────────────────────
  fastify.get('/summary', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = uid(req)

    const results = await FarmSale.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id:   { month: '$month', year: '$year' },
          total: { $sum: '$amount' },
          paid:  { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] } },
          partial: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, '$amount', 0] } },
          unpaid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, '$amount', 0] } },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ])

    const byMonth = results.map((r) => ({
      month:   r._id.month,
      year:    r._id.year,
      total:   r.total,
      paid:    r.paid,
      partial: r.partial,
      unpaid:  r.unpaid,
    }))

    return reply.send({ byMonth })
  })

  // ── GET /api/sales ────────────────────────────────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = uid(req)
    const { month, year } = req.query as { month?: string; year?: string }

    const filter: Record<string, unknown> = { userId }
    if (month) filter.month = parseInt(month, 10)
    if (year)  filter.year  = parseInt(year, 10)

    const sales = await FarmSale.find(filter).sort({ date: -1 }).lean()
    return reply.send(sales.map(serializeSale as never))
  })

  // ── GET /api/sales/:saleId ────────────────────────────────────────────────
  fastify.get('/:saleId', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = uid(req)
    const { saleId } = req.params as { saleId: string }

    const sale = await FarmSale.findOne({ _id: saleId, userId })
    if (!sale) return notFound(reply)
    return reply.send(serializeSale(sale))
  })

  // ── POST /api/sales ───────────────────────────────────────────────────────
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const parsed = CreateSaleSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', issues: parsed.error.issues })
    }

    const data = parsed.data
    const date  = new Date(data.date)
    const month = date.getMonth() + 1
    const year  = date.getFullYear()

    const sale = new FarmSale({
      userId,
      description:   data.description,
      amount:        data.amount,
      date,
      month,
      year,
      paymentStatus: data.paymentStatus,
      notes:         data.notes ?? null,
    })

    await sale.save()
    return reply.code(201).send(serializeSale(sale))
  })

  // ── PATCH /api/sales/:saleId ──────────────────────────────────────────────
  fastify.patch('/:saleId', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const { saleId } = req.params as { saleId: string }

    const sale = await FarmSale.findOne({ _id: saleId, userId })
    if (!sale) return notFound(reply)

    const parsed = UpdateSaleSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', issues: parsed.error.issues })
    }

    const data = parsed.data

    if (data.date) {
      const date   = new Date(data.date)
      sale.date  = date
      sale.month = date.getMonth() + 1
      sale.year  = date.getFullYear()
    }
    if (data.description   !== undefined) sale.description   = data.description
    if (data.amount        !== undefined) sale.amount        = data.amount
    if (data.paymentStatus !== undefined) sale.paymentStatus = data.paymentStatus
    if (data.notes         !== undefined) sale.notes         = data.notes ?? null

    await sale.save()
    return reply.send(serializeSale(sale))
  })

  // ── DELETE /api/sales/:saleId ─────────────────────────────────────────────
  fastify.delete('/:saleId', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const { saleId } = req.params as { saleId: string }

    const sale = await FarmSale.findOne({ _id: saleId, userId })
    if (!sale) return notFound(reply)

    await sale.deleteOne()
    return reply.send({ success: true })
  })
}
