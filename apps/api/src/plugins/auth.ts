import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { User } from '../models/user.js'

export interface JwtPayload {
  sub: string       // userId
  email: string
  username: string
  type: 'access' | 'refresh'
}

// Extend fastify-jwt types for the default (access) namespace
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    // Exposed so auth routes can sign/verify refresh tokens
    signRefreshToken: (payload: Omit<JwtPayload, 'type'>) => string
    verifyRefreshToken: (token: string) => JwtPayload
  }
}

async function authPlugin(fastify: FastifyInstance) {
  const accessSecret = process.env.JWT_SECRET
  const refreshSecret = process.env.JWT_REFRESH_SECRET

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set')
  }

  const accessExpiresIn = process.env.JWT_EXPIRES_IN ?? '15m'
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d'

  // Primary JWT instance — used by req.jwtVerify() and reply.jwtSign()
  await fastify.register(jwt, {
    secret: accessSecret,
    sign: { expiresIn: accessExpiresIn },
  })

  // Refresh token namespace — fastify.jwt.refresh gives separate sign/verify
  // @fastify/jwt supports a second registration with a different namespace
  await fastify.register(jwt, {
    secret: refreshSecret,
    namespace: 'refresh',
    jwtVerify: 'refreshVerify',
    jwtSign: 'refreshSign',
    sign: { expiresIn: refreshExpiresIn },
  } as Parameters<typeof jwt>[1])

  // Decorate: sign a refresh token
  fastify.decorate('signRefreshToken', function (payload: Omit<JwtPayload, 'type'>): string {
    // @ts-expect-error — namespace types not merged automatically
    return fastify.jwt.refresh.sign({ ...payload, type: 'refresh' })
  })

  // Decorate: verify a refresh token
  fastify.decorate('verifyRefreshToken', function (token: string): JwtPayload {
    // @ts-expect-error — namespace types not merged automatically
    return fastify.jwt.refresh.verify(token) as JwtPayload
  })

  // Decorate: authenticate middleware for protected routes
  fastify.decorate(
    'authenticate',
    async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        await req.jwtVerify()
        if ((req.user as JwtPayload).type !== 'access') {
          reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token type' })
        }
      } catch {
        reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
      }
    },
  )

  // Decorate: admin-only middleware — must be authenticated AND isAdmin: true
  fastify.decorate(
    'requireAdmin',
    async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        await req.jwtVerify()
        if ((req.user as JwtPayload).type !== 'access') {
          return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token type' })
        }
      } catch {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
      }

      const userId = (req.user as JwtPayload).sub
      const user = await User.findById(userId).select('isAdmin').lean()
      if (!user?.isAdmin) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Admin access required', statusCode: 403 })
      }
    },
  )
}

export default fp(authPlugin, { name: 'auth' })
