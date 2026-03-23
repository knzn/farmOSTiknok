import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Queue } from 'bullmq'
import { Redis as IORedis } from 'ioredis'

export interface VideoTranscodeJobData {
  postId: string
  rawVideoKey: string  // DO Spaces object key (not full URL)
  filename: string
}

declare module 'fastify' {
  interface FastifyInstance {
    queues: {
      videoTranscode: Queue<VideoTranscodeJobData>
    }
  }
}

export default fp(async function queuePlugin(fastify: FastifyInstance) {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    fastify.log.warn('REDIS_URL not set — BullMQ queue plugin using no-op stub')
    fastify.decorate('queues', {
      videoTranscode: { add: async () => ({ id: 'noop' }) } as any,
    })
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null }) as any
  const videoTranscodeQueue = new Queue<VideoTranscodeJobData>('video.transcode', { connection })

  fastify.decorate('queues', { videoTranscode: videoTranscodeQueue })
  fastify.log.info('BullMQ queue plugin registered')

  fastify.addHook('onClose', async () => {
    await videoTranscodeQueue.close()
    await connection.quit()
  })
})
