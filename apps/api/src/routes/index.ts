import type { FastifyInstance } from 'fastify'
import authRoutes from './auth.js'
import seasonRoutes from './seasons.js'
import postRoutes from './posts.js'
import feedRoutes from './feed.js'
import userRoutes from './users.js'
import dashboardRoutes from './dashboard.js'
import workerRoutes from './workers.js'
import expenseRoutes from './expenses.js'
import adminRoutes from './admin.js'

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.register(authRoutes, { prefix: '/api/auth' })
  fastify.register(seasonRoutes, { prefix: '/api/seasons' })
  fastify.register(postRoutes, { prefix: '/api/posts' })
  fastify.register(feedRoutes, { prefix: '/api/feed' })
  fastify.register(userRoutes, { prefix: '/api/users' })
  fastify.register(dashboardRoutes, { prefix: '/api/dashboard' })
  fastify.register(workerRoutes, { prefix: '/api/workers' })
  fastify.register(expenseRoutes, { prefix: '/api/expenses' })
  fastify.register(adminRoutes, { prefix: '/api/admin' })
}
