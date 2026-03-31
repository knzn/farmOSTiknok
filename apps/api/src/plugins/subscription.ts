import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { User } from '../models/user.js'
import type { JwtPayload } from './auth.js'

declare module 'fastify' {
  interface FastifyInstance {
    requireSubscription: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

async function subscriptionPlugin(fastify: FastifyInstance) {
  fastify.decorate(
    'requireSubscription',
    async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
      // Verify JWT only if not already verified by authenticate hook
      if (!req.user) {
        try {
          await req.jwtVerify()
          if ((req.user as JwtPayload).type !== 'access') {
            return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token type' })
          }
        } catch {
          return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
        }
      }

      const userId = (req.user as JwtPayload).sub
      const user = await User.findById(userId)
        .select('isAdmin subscriptionStatus trialEndsAt paidUntil')
        .lean()

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'User not found' })
      }

      // Admins always have full access
      if (user.isAdmin) return

      const now = new Date()

      // Resolve current status dynamically (handles cases where cron hasn't run yet)
      let status = user.subscriptionStatus

      if (status === 'trial' && user.trialEndsAt && user.trialEndsAt < now) {
        status = 'expired'
      }
      if (status === 'active' && user.paidUntil && user.paidUntil < now) {
        status = 'expired'
      }

      if (status === 'suspended') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Your account has been suspended. Contact support.',
          code: 'ACCOUNT_SUSPENDED',
          statusCode: 403,
        })
      }

      if (status === 'expired') {
        return reply.code(403).send({
          error: 'Subscription Required',
          message: 'Your free trial has ended. Subscribe to continue.',
          code: 'SUBSCRIPTION_REQUIRED',
          statusCode: 403,
        })
      }

      // trial or active — allow through
    },
  )
}

export default fp(subscriptionPlugin, { name: 'subscription' })
