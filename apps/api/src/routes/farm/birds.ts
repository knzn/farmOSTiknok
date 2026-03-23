import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Bird } from '../../models/bird.js'

function userId(req: any): string {
  return req.user._id.toString()
}

const CATEGORIES = ['stag', 'cock', 'pullet', 'brood_hen', 'chick'] as const
const STATUSES = ['active', 'retired', 'sold', 'deceased'] as const

const BirdBodySchema = z.object({
  name: z.string().min(1).max(100),
  bloodline: z.string().max(100).nullable().optional(),
  marking: z.string().max(50).nullable().optional(),
  matingId: z.string().nullable().optional(),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES).default('active'),
  birthDate: z.string().datetime().nullable().optional(),
  weight: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  parentMaleId: z.string().nullable().optional(),
  parentFemaleId: z.string().nullable().optional(),
})

const BirdUpdateSchema = BirdBodySchema.partial()

export default async function birdRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/farm/birds
   * Add a bird profile.
   */
  fastify.post('/birds', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const body = BirdBodySchema.parse(req.body)
    const bird = await Bird.create({ ...body, userId: uid })
    return reply.code(201).send(serializeBird(bird))
  })

  /**
   * GET /api/farm/birds
   * List all birds. Optional ?category=stag&status=active filters.
   */
  fastify.get('/birds', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const query = req.query as { category?: string; status?: string; cursor?: string; limit?: string }
    const limit = Math.min(parseInt(query.limit ?? '50'), 100)

    const filter: Record<string, unknown> = { userId: uid }
    if (query.category && CATEGORIES.includes(query.category as any)) filter.category = query.category
    if (query.status && STATUSES.includes(query.status as any)) filter.status = query.status
    if (query.cursor) filter._id = { $lt: query.cursor }

    const birds = await Bird.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean()
    const hasMore = birds.length > limit
    if (hasMore) birds.pop()

    return reply.send({
      birds: birds.map(serializeBird),
      nextCursor: hasMore ? birds[birds.length - 1]?._id.toString() : null,
    })
  })

  /**
   * GET /api/farm/birds/:birdId
   * Get a single bird.
   */
  fastify.get<{ Params: { birdId: string } }>('/birds/:birdId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const bird = await Bird.findOne({ _id: req.params.birdId, userId: userId(req) }).lean()
    if (!bird) return reply.code(404).send({ error: 'Bird not found' })
    return reply.send(serializeBird(bird))
  })

  /**
   * PATCH /api/farm/birds/:birdId
   * Update a bird profile.
   */
  fastify.patch<{ Params: { birdId: string } }>('/birds/:birdId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const body = BirdUpdateSchema.parse(req.body)
    const bird = await Bird.findOneAndUpdate(
      { _id: req.params.birdId, userId: userId(req) },
      { $set: body },
      { new: true },
    ).lean()
    if (!bird) return reply.code(404).send({ error: 'Bird not found' })
    return reply.send(serializeBird(bird))
  })

  /**
   * DELETE /api/farm/birds/:birdId
   * Delete a bird profile.
   */
  fastify.delete<{ Params: { birdId: string } }>('/birds/:birdId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const bird = await Bird.findOneAndDelete({ _id: req.params.birdId, userId: userId(req) })
    if (!bird) return reply.code(404).send({ error: 'Bird not found' })
    return reply.send({ message: 'Bird deleted' })
  })
}

function serializeBird(b: any) {
  return {
    _id: b._id.toString(),
    name: b.name,
    bloodline: b.bloodline ?? null,
    marking: b.marking ?? null,
    matingId: b.matingId?.toString() ?? null,
    category: b.category,
    status: b.status,
    birthDate: b.birthDate ? new Date(b.birthDate).toISOString() : null,
    weight: b.weight ?? null,
    notes: b.notes ?? null,
    photoUrl: b.photoUrl ?? null,
    parentMaleId: b.parentMaleId?.toString() ?? null,
    parentFemaleId: b.parentFemaleId?.toString() ?? null,
    createdAt: new Date(b.createdAt).toISOString(),
    updatedAt: new Date(b.updatedAt).toISOString(),
  }
}
