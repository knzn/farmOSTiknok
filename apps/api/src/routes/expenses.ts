import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { FarmExpense, CATEGORY_TYPE_MAP, type ExpenseCategory } from '../models/expense.js'
import type { JwtPayload } from '../plugins/auth.js'

// ─── helpers ────────────────────────────────────────────────────────────────

function uid(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

function forbidden(reply: FastifyReply, msg = 'This entry is locked and cannot be modified.') {
  return reply.code(403).send({ error: 'Forbidden', message: msg, statusCode: 403 })
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: 'Not Found', message: 'Expense not found', statusCode: 404 })
}

function computeTotal(data: {
  type: 'unit' | 'direct'
  quantity?: number | null
  pricePerUnit?: number | null
  amount?: number | null
}): number {
  if (data.type === 'unit') {
    const qty = data.quantity ?? 0
    const price = data.pricePerUnit ?? 0
    return Math.round(qty * price * 100) / 100
  }
  return data.amount ?? 0
}

function serializeExpense(e: InstanceType<typeof FarmExpense>) {
  return {
    id:           e._id,
    category:     e.category,
    type:         e.type,
    date:         e.date,
    month:        e.month,
    year:         e.year,
    name:         e.name ?? null,
    unit:         e.unit ?? null,
    quantity:     e.quantity ?? null,
    pricePerUnit: e.pricePerUnit ?? null,
    totalAmount:  e.totalAmount,
    description:  e.description ?? null,
    amount:       e.amount ?? null,
    receiptUrl:   e.receiptUrl ?? null,
    notes:        e.notes ?? null,
    locked:       e.locked,
    lockedAt:     e.lockedAt ?? null,
    createdAt:    e.createdAt,
    updatedAt:    e.updatedAt,
  }
}

// ─── validation schemas ──────────────────────────────────────────────────────

const CATEGORIES = [
  'feeds', 'vitamins', 'medicines', 'deworming', 'workers_extra_budget', 'miscellaneous',
] as const

const CreateExpenseSchema = z.discriminatedUnion('category', [
  // unit types
  z.object({
    category:     z.enum(['feeds', 'vitamins', 'medicines', 'deworming']),
    date:         z.string().min(1),
    name:         z.string().min(1).max(200).trim(),
    unit:         z.string().min(1).max(50),
    quantity:     z.number().positive(),
    pricePerUnit: z.number().min(0),
    notes:        z.string().max(500).trim().nullable().optional(),
  }),
  // direct types
  z.object({
    category:    z.enum(['workers_extra_budget']),
    date:        z.string().min(1),
    amount:      z.number().min(0).default(0),
    notes:       z.string().max(500).trim().nullable().optional(),
  }),
  z.object({
    category:    z.enum(['miscellaneous']),
    date:        z.string().min(1),
    description: z.string().min(1).max(300).trim(),
    amount:      z.number().min(0),
    notes:       z.string().max(500).trim().nullable().optional(),
  }),
])

const UpdateExpenseSchema = z.object({
  date:         z.string().min(1).optional(),
  name:         z.string().min(1).max(200).trim().optional(),
  unit:         z.string().min(1).max(50).optional(),
  quantity:     z.number().positive().optional(),
  pricePerUnit: z.number().min(0).optional(),
  description:  z.string().min(1).max(300).trim().optional(),
  amount:       z.number().min(0).optional(),
  notes:        z.string().max(500).trim().nullable().optional(),
})

// ─── routes ─────────────────────────────────────────────────────────────────

export default async function expenseRoutes(fastify: FastifyInstance) {
  // ── GET /api/expenses/summary ──────────────────────────────────────────────
  // Must be registered before /:expenseId to avoid route conflict
  fastify.get('/summary', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = uid(req)

    const results = await FarmExpense.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id:      { month: '$month', year: '$year' },
          total:    { $sum: '$totalAmount' },
          feeds:               { $sum: { $cond: [{ $eq: ['$category', 'feeds'] }, '$totalAmount', 0] } },
          vitamins:            { $sum: { $cond: [{ $eq: ['$category', 'vitamins'] }, '$totalAmount', 0] } },
          medicines:           { $sum: { $cond: [{ $eq: ['$category', 'medicines'] }, '$totalAmount', 0] } },
          deworming:           { $sum: { $cond: [{ $eq: ['$category', 'deworming'] }, '$totalAmount', 0] } },
          workers_extra_budget:{ $sum: { $cond: [{ $eq: ['$category', 'workers_extra_budget'] }, '$totalAmount', 0] } },
          miscellaneous:       { $sum: { $cond: [{ $eq: ['$category', 'miscellaneous'] }, '$totalAmount', 0] } },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ])

    const byMonth = results.map((r) => ({
      month: r._id.month,
      year:  r._id.year,
      total: r.total,
      byCategory: {
        feeds:                r.feeds,
        vitamins:             r.vitamins,
        medicines:            r.medicines,
        deworming:            r.deworming,
        workers_extra_budget: r.workers_extra_budget,
        miscellaneous:        r.miscellaneous,
      },
    }))

    return reply.send({ byMonth })
  })

  // ── GET /api/expenses ──────────────────────────────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = uid(req)
    const { month, year } = req.query as { month?: string; year?: string }

    const filter: Record<string, unknown> = { userId }
    if (month) filter.month = parseInt(month, 10)
    if (year)  filter.year  = parseInt(year, 10)

    const expenses = await FarmExpense
      .find(filter)
      .sort({ date: -1 })
      .lean()

    return reply.send(expenses.map(serializeExpense as never))
  })

  // ── GET /api/expenses/:expenseId ───────────────────────────────────────────
  fastify.get('/:expenseId', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = uid(req)
    const { expenseId } = req.params as { expenseId: string }

    const expense = await FarmExpense.findOne({ _id: expenseId, userId })
    if (!expense) return notFound(reply)

    return reply.send(serializeExpense(expense))
  })

  // ── POST /api/expenses ─────────────────────────────────────────────────────
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const parsed = CreateExpenseSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', issues: parsed.error.issues })
    }

    const data = parsed.data
    const type = CATEGORY_TYPE_MAP[data.category as ExpenseCategory]
    const date = new Date(data.date)
    const month = date.getMonth() + 1
    const year  = date.getFullYear()

    const totalAmount = computeTotal({
      type,
      quantity:     'quantity' in data ? data.quantity : undefined,
      pricePerUnit: 'pricePerUnit' in data ? data.pricePerUnit : undefined,
      amount:       'amount' in data ? data.amount : undefined,
    })

    const expense = new FarmExpense({
      userId,
      category: data.category,
      type,
      date,
      month,
      year,
      name:         'name' in data ? data.name : null,
      unit:         'unit' in data ? data.unit : null,
      quantity:     'quantity' in data ? data.quantity : null,
      pricePerUnit: 'pricePerUnit' in data ? data.pricePerUnit : null,
      totalAmount,
      description:  'description' in data ? data.description : null,
      amount:       'amount' in data ? data.amount : null,
      notes:        data.notes ?? null,
    })

    await expense.save()
    return reply.code(201).send(serializeExpense(expense))
  })

  // ── PATCH /api/expenses/:expenseId ─────────────────────────────────────────
  fastify.patch('/:expenseId', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const { expenseId } = req.params as { expenseId: string }

    const expense = await FarmExpense.findOne({ _id: expenseId, userId })
    if (!expense) return notFound(reply)
    if (expense.locked) return forbidden(reply)

    const parsed = UpdateExpenseSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', issues: parsed.error.issues })
    }

    const data = parsed.data

    if (data.date) {
      const date = new Date(data.date)
      expense.date  = date
      expense.month = date.getMonth() + 1
      expense.year  = date.getFullYear()
    }
    if (data.name         !== undefined) expense.name         = data.name ?? null
    if (data.unit         !== undefined) expense.unit         = data.unit ?? null
    if (data.quantity     !== undefined) expense.quantity     = data.quantity ?? null
    if (data.pricePerUnit !== undefined) expense.pricePerUnit = data.pricePerUnit ?? null
    if (data.description  !== undefined) expense.description  = data.description ?? null
    if (data.amount       !== undefined) expense.amount       = data.amount ?? null
    if (data.notes        !== undefined) expense.notes        = data.notes ?? null

    // Always recompute totalAmount from stored values after update
    expense.totalAmount = computeTotal({
      type:         expense.type,
      quantity:     expense.quantity,
      pricePerUnit: expense.pricePerUnit,
      amount:       expense.amount,
    })

    await expense.save()
    return reply.send(serializeExpense(expense))
  })

  // ── DELETE /api/expenses/:expenseId ────────────────────────────────────────
  fastify.delete('/:expenseId', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const { expenseId } = req.params as { expenseId: string }

    const expense = await FarmExpense.findOne({ _id: expenseId, userId })
    if (!expense) return notFound(reply)
    if (expense.locked) return forbidden(reply)

    await expense.deleteOne()
    return reply.send({ success: true })
  })

  // ── POST /api/expenses/:expenseId/receipt ──────────────────────────────────
  fastify.post('/:expenseId/receipt', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const { expenseId } = req.params as { expenseId: string }

    const expense = await FarmExpense.findOne({ _id: expenseId, userId })
    if (!expense) return notFound(reply)
    if (expense.locked) return forbidden(reply)

    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    // Delete old receipt from DO Spaces if exists
    if (expense.receiptUrl) {
      try {
        const key = expense.receiptUrl.split('/').slice(-2).join('/')
        await fastify.storage.deleteObject({ key })
      } catch { /* ignore — old file cleanup is best-effort */ }
    }

    const ext = data.mimetype === 'image/png' ? 'png' : 'jpg'
    const key = `receipts/${userId}/${expenseId}.${ext}`
    const buffer = await data.toBuffer()
    const url = await fastify.storage.uploadObject({ key, body: buffer, contentType: data.mimetype })

    expense.receiptUrl = url
    await expense.save()

    return reply.send({ receiptUrl: url })
  })

  // ── DELETE /api/expenses/:expenseId/receipt ────────────────────────────────
  fastify.delete('/:expenseId/receipt', { onRequest: [fastify.authenticate, fastify.requireSubscription] }, async (req, reply) => {
    const userId = uid(req)
    const { expenseId } = req.params as { expenseId: string }

    const expense = await FarmExpense.findOne({ _id: expenseId, userId })
    if (!expense) return notFound(reply)
    if (expense.locked) return forbidden(reply)
    if (!expense.receiptUrl) return reply.send({ success: true })

    try {
      const key = expense.receiptUrl.split('/').slice(-2).join('/')
      await fastify.storage.deleteObject({ key })
    } catch { /* best-effort */ }

    expense.receiptUrl = null
    await expense.save()

    return reply.send({ success: true })
  })
}
