import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FeedProgram } from '../../models/feedProgram.js'
import { FarmInventory } from '../../models/farmInventory.js'

function userId(req: any): string {
  return req.user._id.toString()
}

const SaveFeedProgramSchema = z.object({
  gramsPerFeeding: z.number().int().min(1).max(500),
  feedingsPerDay: z.union([z.literal(1), z.literal(2)]),
  fastingDaysPerWeek: z.number().int().min(0).max(7).default(0),
  costPerKg: z.number().min(0),
  currency: z.string().max(10).default('PHP'),
})

function calculate(
  birds: number,
  gramsPerFeeding: number,
  feedingsPerDay: number,
  fastingDaysPerWeek: number,
  costPerKg: number,
) {
  const dailyGrams = birds * gramsPerFeeding * feedingsPerDay
  const dailyKg = dailyGrams / 1000
  const weeklyKg = dailyKg * (7 - fastingDaysPerWeek)
  const monthlyKg = weeklyKg * 4.33
  const monthlyCost = monthlyKg * costPerKg
  return {
    dailyKg: Math.round(dailyKg * 100) / 100,
    weeklyKg: Math.round(weeklyKg * 100) / 100,
    monthlyKg: Math.round(monthlyKg * 100) / 100,
    monthlyCost: Math.round(monthlyCost * 100) / 100,
  }
}

export default async function feedProgramRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/farm/feed-program
   * Returns the user's saved feed program settings.
   */
  fastify.get('/feed-program', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const program = await FeedProgram.findOne({ userId: uid }).lean()
    return reply.send(program ?? null)
  })

  /**
   * PUT /api/farm/feed-program
   * Save/update the user's feed program settings.
   */
  fastify.put('/feed-program', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const body = SaveFeedProgramSchema.parse(req.body)

    const program = await FeedProgram.findOneAndUpdate(
      { userId: uid },
      { $set: { ...body, userId: uid } },
      { upsert: true, new: true, lean: true },
    )
    return reply.send(program)
  })

  /**
   * GET /api/farm/feed-calculator
   * Calculates feed requirements using the saved program + current inventory total.
   * Optional query param: ?birds=N to override bird count.
   */
  fastify.get('/feed-calculator', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const query = req.query as { birds?: string }

    const [program, inventory] = await Promise.all([
      FeedProgram.findOne({ userId: uid }).lean(),
      FarmInventory.findOne({ userId: uid }).lean(),
    ])

    if (!program) {
      return reply.send({ hasData: false, birds: 0, dailyKg: 0, weeklyKg: 0, monthlyKg: 0, monthlyCost: 0, currency: 'PHP' })
    }

    const inventoryTotal = inventory
      ? (inventory.stags + inventory.pullets + inventory.broodHens + inventory.chicks + inventory.cocks)
      : 0

    const birds = query.birds ? parseInt(query.birds) : inventoryTotal

    const result = calculate(
      birds,
      program.gramsPerFeeding,
      program.feedingsPerDay,
      program.fastingDaysPerWeek,
      program.costPerKg,
    )

    return reply.send({
      hasData: true,
      birds,
      ...result,
      currency: program.currency,
    })
  })
}
