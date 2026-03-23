import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FarmInventory } from '../../models/farmInventory.js'

function userId(req: any): string {
  return req.user._id.toString()
}

const UpdateInventorySchema = z.object({
  stags: z.number().int().min(0),
  pullets: z.number().int().min(0),
  broodHens: z.number().int().min(0),
  chicks: z.number().int().min(0),
  cocks: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
})

export default async function inventoryRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/farm/inventory
   * Returns the user's farm inventory. Creates a blank record if none exists.
   */
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)

    const inventory = await FarmInventory.findOneAndUpdate(
      { userId: uid },
      { $setOnInsert: { userId: uid, stags: 0, pullets: 0, broodHens: 0, chicks: 0, cocks: 0, notes: null } },
      { upsert: true, new: true, lean: true },
    )

    const total = (inventory!.stags ?? 0) + (inventory!.pullets ?? 0) +
      (inventory!.broodHens ?? 0) + (inventory!.chicks ?? 0) + (inventory!.cocks ?? 0)

    return reply.send({ ...inventory, total })
  })

  /**
   * PUT /api/farm/inventory
   * Upserts the user's farm inventory counts.
   */
  fastify.put('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const body = UpdateInventorySchema.parse(req.body)

    const inventory = await FarmInventory.findOneAndUpdate(
      { userId: uid },
      { $set: { ...body, userId: uid } },
      { upsert: true, new: true, lean: true },
    )

    const total = (inventory!.stags ?? 0) + (inventory!.pullets ?? 0) +
      (inventory!.broodHens ?? 0) + (inventory!.chicks ?? 0) + (inventory!.cocks ?? 0)

    return reply.send({ ...inventory, total })
  })
}
