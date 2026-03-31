import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { Worker, POSITION_PRESETS } from '../models/worker.js'
import type { JwtPayload } from '../plugins/auth.js'

// ─── helpers ────────────────────────────────────────────────────────────────

function userId(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

function notFound(reply: FastifyReply, msg = 'Not found') {
  return reply.code(404).send({ error: 'Not Found', message: msg, statusCode: 404 })
}

async function requireWorker(workerId: string, uid: string) {
  const worker = await Worker.findOne({ _id: workerId, userId: uid })
  if (!worker) return null
  return worker
}

function serializeWorker(w: Awaited<ReturnType<typeof Worker.findOne>> & NonNullable<unknown>) {
  return {
    id: w._id,
    name: w.name,
    position: w.position,
    monthlySalary: w.monthlySalary,
    salaryDay: w.salaryDay ?? 30,
    photo: w.photo ?? null,
    address: w.address ?? null,
    phoneNumber: w.phoneNumber ?? null,
    fbLink: w.fbLink ?? null,
    advances: w.advances.map((a) => ({
      id: a._id,
      amount: a.amount,
      reason: a.reason ?? null,
      date: a.date,
      month: a.month,
      year: a.year,
      createdAt: a.createdAt,
    })),
    payments: w.payments.map((p) => ({
      id: p._id,
      month: p.month,
      year: p.year,
      grossSalary: p.grossSalary,
      totalAdvances: p.totalAdvances,
      netPay: p.netPay,
      paidAt: p.paidAt,
    })),
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }
}

// ─── validation schemas ──────────────────────────────────────────────────────

const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  position: z.string().min(1).max(100).trim(),
  monthlySalary: z.number().min(0),
  salaryDay: z.number().int().min(1).max(31).optional().default(30),
  address: z.string().max(300).trim().optional(),
  phoneNumber: z.string().max(50).trim().optional(),
  fbLink: z.string().max(300).trim().optional(),
})

const UpdateWorkerSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  position: z.string().min(1).max(100).trim().optional(),
  monthlySalary: z.number().min(0).optional(),
  salaryDay: z.number().int().min(1).max(31).optional(),
  address: z.string().max(300).trim().nullable().optional(),
  phoneNumber: z.string().max(50).trim().nullable().optional(),
  fbLink: z.string().max(300).trim().nullable().optional(),
})

const AddAdvanceSchema = z.object({
  amount: z.number().min(1),
  reason: z.string().max(300).trim().nullable().optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
})

const MarkPaidSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
})

// ─── routes ─────────────────────────────────────────────────────────────────

export default async function workerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate)

  // Write routes require active subscription
  fastify.addHook('preHandler', async (req, reply) => {
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      await fastify.requireSubscription(req, reply)
    }
  })

  // GET /api/workers/positions  — return preset list
  fastify.get('/positions', async () => {
    return { positions: POSITION_PRESETS }
  })

  // GET /api/workers
  fastify.get('/', async (req) => {
    const workers = await Worker.find({ userId: userId(req) }).sort({ createdAt: -1 })
    return workers.map(serializeWorker)
  })

  // POST /api/workers
  fastify.post('/', async (req, reply) => {
    const input = CreateWorkerSchema.parse(req.body)
    const worker = await Worker.create({ ...input, userId: userId(req) })
    return reply.code(201).send(serializeWorker(worker))
  })

  // GET /api/workers/:workerId
  fastify.get<{ Params: { workerId: string } }>('/:workerId', async (req, reply) => {
    const worker = await requireWorker(req.params.workerId, userId(req))
    if (!worker) return notFound(reply, 'Worker not found')
    return serializeWorker(worker)
  })

  // PATCH /api/workers/:workerId
  fastify.patch<{ Params: { workerId: string } }>('/:workerId', async (req, reply) => {
    const input = UpdateWorkerSchema.parse(req.body)
    const worker = await Worker.findOneAndUpdate(
      { _id: req.params.workerId, userId: userId(req) },
      { $set: input },
      { new: true },
    )
    if (!worker) return notFound(reply, 'Worker not found')
    return serializeWorker(worker)
  })

  // DELETE /api/workers/:workerId
  fastify.delete<{ Params: { workerId: string } }>('/:workerId', async (req, reply) => {
    const worker = await Worker.findOneAndDelete({ _id: req.params.workerId, userId: userId(req) })
    if (!worker) return notFound(reply, 'Worker not found')
    return reply.code(204).send()
  })

  // POST /api/workers/:workerId/photo
  fastify.post<{ Params: { workerId: string } }>('/:workerId/photo', async (req, reply) => {
    const worker = await requireWorker(req.params.workerId, userId(req))
    if (!worker) return notFound(reply, 'Worker not found')

    const data = await req.file()
    if (!data) return reply.code(400).send({ message: 'No file uploaded' })

    const buffer = await data.toBuffer()
    const ext = data.filename.split('.').pop() ?? 'jpg'
    const key = `worker-photos/${worker._id}-${Date.now()}.${ext}`
    const url = await fastify.storage.uploadBuffer(buffer, key, data.mimetype, 'worker-photos')

    worker.photo = url
    await worker.save()
    return { photo: url }
  })

  // DELETE /api/workers/:workerId/photo
  fastify.delete<{ Params: { workerId: string } }>('/:workerId/photo', async (req, reply) => {
    const worker = await requireWorker(req.params.workerId, userId(req))
    if (!worker) return notFound(reply, 'Worker not found')
    worker.photo = null
    await worker.save()
    return reply.code(204).send()
  })

  // POST /api/workers/:workerId/advances
  fastify.post<{ Params: { workerId: string } }>('/:workerId/advances', async (req, reply) => {
    const worker = await requireWorker(req.params.workerId, userId(req))
    if (!worker) return notFound(reply, 'Worker not found')

    const input = AddAdvanceSchema.parse(req.body)
    const date = new Date(input.date)
    const month = date.getMonth() + 1
    const year = date.getFullYear()

    // Block advance if that month is already paid
    const alreadyPaid = worker.payments.some((p) => p.month === month && p.year === year)
    if (alreadyPaid) {
      return reply.code(400).send({ message: `Salary for ${month}/${year} is already marked as paid. Cannot add advances.` })
    }

    worker.advances.push({
      amount: input.amount,
      reason: input.reason ?? null,
      date,
      month,
      year,
    } as any)

    await worker.save()
    return reply.code(201).send(serializeWorker(worker))
  })

  // DELETE /api/workers/:workerId/advances/:advanceId
  fastify.delete<{ Params: { workerId: string; advanceId: string } }>(
    '/:workerId/advances/:advanceId',
    async (req, reply) => {
      const worker = await requireWorker(req.params.workerId, userId(req))
      if (!worker) return notFound(reply, 'Worker not found')

      const advance = worker.advances.id(req.params.advanceId)
      if (!advance) return notFound(reply, 'Advance not found')

      // Block delete if that month is already paid
      const alreadyPaid = worker.payments.some(
        (p) => p.month === advance.month && p.year === advance.year,
      )
      if (alreadyPaid) {
        return reply.code(400).send({ message: 'Cannot delete advance from a paid month.' })
      }

      advance.deleteOne()
      await worker.save()
      return reply.code(204).send()
    },
  )

  // POST /api/workers/:workerId/pay  — mark a month as paid
  fastify.post<{ Params: { workerId: string } }>('/:workerId/pay', async (req, reply) => {
    const worker = await requireWorker(req.params.workerId, userId(req))
    if (!worker) return notFound(reply, 'Worker not found')

    const { month, year } = MarkPaidSchema.parse(req.body)

    const alreadyPaid = worker.payments.some((p) => p.month === month && p.year === year)
    if (alreadyPaid) {
      return reply.code(400).send({ message: `Salary for ${month}/${year} is already marked as paid.` })
    }

    const grossSalary = worker.monthlySalary
    const totalAdvances = worker.advances
      .filter((a) => a.month === month && a.year === year)
      .reduce((sum, a) => sum + a.amount, 0)
    const netPay = Math.max(0, grossSalary - totalAdvances)

    worker.payments.push({
      month,
      year,
      grossSalary,
      totalAdvances,
      netPay,
      paidAt: new Date(),
    } as any)

    await worker.save()
    return serializeWorker(worker)
  })
}
