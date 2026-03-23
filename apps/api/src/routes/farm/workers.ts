import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Worker } from '../../models/worker.js'

function userId(req: any): string {
  return req.user._id.toString()
}

const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  role: z.string().max(100).trim().nullable().optional(),
  payType: z.enum(['daily', 'monthly']),
  payAmount: z.number().min(0),
  currency: z.string().max(10).default('PHP'),
  notes: z.string().max(500).nullable().optional(),
})

const UpdateWorkerSchema = CreateWorkerSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// Monthly cost formula: daily × 26, monthly as-is
function monthlyAmount(payType: string, payAmount: number): number {
  return payType === 'daily' ? payAmount * 26 : payAmount
}

export default async function workerRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/farm/workers
   * Add a new worker.
   */
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const body = CreateWorkerSchema.parse(req.body)

    const worker = await Worker.create({ ...body, userId: uid })
    return reply.code(201).send(worker)
  })

  /**
   * GET /api/farm/workers
   * List all workers for the user.
   */
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const workers = await Worker.find({ userId: uid }).sort({ isActive: -1, createdAt: -1 }).lean()

    const monthlyTotal = workers
      .filter(w => w.isActive)
      .reduce((sum, w) => sum + monthlyAmount(w.payType, w.payAmount), 0)

    return reply.send({ workers, monthlyTotal, currency: 'PHP' })
  })

  /**
   * PATCH /api/farm/workers/:workerId
   * Update a worker.
   */
  fastify.patch('/:workerId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const { workerId } = req.params as { workerId: string }
    const body = UpdateWorkerSchema.parse(req.body)

    const worker = await Worker.findOneAndUpdate(
      { _id: workerId, userId: uid },
      { $set: body },
      { new: true, lean: true },
    )
    if (!worker) return reply.code(404).send({ message: 'Worker not found' })
    return reply.send(worker)
  })

  /**
   * DELETE /api/farm/workers/:workerId
   * Delete a worker.
   */
  fastify.delete('/:workerId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const { workerId } = req.params as { workerId: string }

    const result = await Worker.deleteOne({ _id: workerId, userId: uid })
    if (result.deletedCount === 0) return reply.code(404).send({ message: 'Worker not found' })
    return reply.code(204).send()
  })
}
