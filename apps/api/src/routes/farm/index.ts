import type { FastifyInstance } from 'fastify'
import inventoryRoutes from './inventory.js'
import feedProgramRoutes from './feedProgram.js'
import workerRoutes from './workers.js'
import fightRoutes from './fights.js'
import birdRoutes from './birds.js'

export default async function farmRoutes(fastify: FastifyInstance) {
  fastify.register(inventoryRoutes, { prefix: '/inventory' })
  fastify.register(feedProgramRoutes)
  fastify.register(workerRoutes, { prefix: '/workers' })
  fastify.register(fightRoutes, { prefix: '/fights' })
  fastify.register(birdRoutes)
}
