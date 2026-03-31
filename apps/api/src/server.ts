import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { connectDB } from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import errorsPlugin from './plugins/errors.js'
import storagePlugin from './plugins/storage.js'
import queuePlugin from './plugins/queue.js'
import subscriptionPlugin from './plugins/subscription.js'
import multipart from '@fastify/multipart'
import { registerRoutes } from './routes/index.js'

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
})

// Connect to MongoDB Atlas
await connectDB()

// Core plugins
await server.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://tiknok.app', 'https://www.tiknok.app']
    : true,
})
await server.register(sensible)
await server.register(errorsPlugin)
await server.register(authPlugin)
await server.register(subscriptionPlugin)
await server.register(storagePlugin)
await server.register(queuePlugin)
await server.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } }) // 500MB max for videos

// Routes
await registerRoutes(server)

// Health check (unauthenticated)
server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await server.listen({ port, host })
  server.log.info(`API listening on http://${host}:${port}`)
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
