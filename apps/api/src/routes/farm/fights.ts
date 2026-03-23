import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FightRecord } from '../../models/fightRecord.js'

function userId(req: any): string {
  return req.user._id.toString()
}

const CreateFightSchema = z.object({
  stagName: z.string().min(1).max(100).trim(),
  bloodline: z.string().max(100).trim().nullable().optional(),
  marking: z.string().max(50).trim().nullable().optional(),
  matingId: z.string().nullable().optional(),
  result: z.enum(['win', 'loss', 'draw', 'cancelled']),
  weightClass: z.string().max(50).trim().nullable().optional(),
  fightDate: z.string().transform(v => new Date(v)),
  notes: z.string().max(1000).nullable().optional(),
})

const UpdateFightSchema = CreateFightSchema.partial()

export default async function fightRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/farm/fights
   * Log a fight result.
   */
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const body = CreateFightSchema.parse(req.body)

    const record = await FightRecord.create({ ...body, userId: uid })
    return reply.code(201).send(record)
  })

  /**
   * GET /api/farm/fights
   * List fight records (cursor paginated).
   */
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const query = req.query as { cursor?: string; limit?: string; result?: string; bloodline?: string }
    const limit = Math.min(parseInt(query.limit ?? '30'), 100)

    const filter: Record<string, unknown> = { userId: uid }
    if (query.result) filter.result = query.result
    if (query.bloodline) filter.bloodline = query.bloodline
    if (query.cursor) filter.fightDate = { $lt: new Date(query.cursor) }

    const records = await FightRecord.find(filter)
      .sort({ fightDate: -1, _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = records.length > limit
    const data = hasMore ? records.slice(0, limit) : records
    const nextCursor = hasMore ? data[data.length - 1]!.fightDate.toISOString() : null

    return reply.send({ records: data, nextCursor })
  })

  /**
   * GET /api/farm/fights/summary
   * Aggregate stats: wins, losses, win rate, best stag, bloodline breakdown.
   */
  fastify.get('/summary', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)

    const records = await FightRecord.find({ userId: uid }).lean()
    if (records.length === 0) {
      return reply.send({ hasData: false, wins: 0, losses: 0, draws: 0, cancelled: 0, winRate: 0, bestStag: null, bloodlines: [] })
    }

    const wins = records.filter(r => r.result === 'win').length
    const losses = records.filter(r => r.result === 'loss').length
    const draws = records.filter(r => r.result === 'draw').length
    const cancelled = records.filter(r => r.result === 'cancelled').length
    const decided = wins + losses
    const winRate = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0

    // Best stag: most wins
    const stagWins: Record<string, number> = {}
    for (const r of records) {
      if (r.result === 'win') stagWins[r.stagName] = (stagWins[r.stagName] ?? 0) + 1
    }
    const bestStag = Object.keys(stagWins).reduce<string | null>(
      (best, name) => (best === null || stagWins[name]! > stagWins[best]!) ? name : best,
      null,
    )

    // Bloodline stats
    const blMap: Record<string, { wins: number; losses: number }> = {}
    for (const r of records) {
      const bl = r.bloodline ?? 'Unknown'
      if (!blMap[bl]) blMap[bl] = { wins: 0, losses: 0 }
      if (r.result === 'win') blMap[bl]!.wins++
      if (r.result === 'loss') blMap[bl]!.losses++
    }
    const bloodlines = Object.entries(blMap)
      .map(([name, stats]) => ({
        name,
        wins: stats.wins,
        losses: stats.losses,
        winRate: (stats.wins + stats.losses) > 0
          ? Math.round((stats.wins / (stats.wins + stats.losses)) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.wins - a.wins)

    return reply.send({ hasData: true, wins, losses, draws, cancelled, winRate, bestStag, bloodlines })
  })

  /**
   * PATCH /api/farm/fights/:fightId
   * Edit a fight record.
   */
  fastify.patch('/:fightId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const { fightId } = req.params as { fightId: string }
    const body = UpdateFightSchema.parse(req.body)

    const record = await FightRecord.findOneAndUpdate(
      { _id: fightId, userId: uid },
      { $set: body },
      { new: true, lean: true },
    )
    if (!record) return reply.code(404).send({ message: 'Fight record not found' })
    return reply.send(record)
  })

  /**
   * DELETE /api/farm/fights/:fightId
   * Delete a fight record.
   */
  fastify.delete('/:fightId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const { fightId } = req.params as { fightId: string }

    const result = await FightRecord.deleteOne({ _id: fightId, userId: uid })
    if (result.deletedCount === 0) return reply.code(404).send({ message: 'Fight record not found' })
    return reply.code(204).send()
  })
}
