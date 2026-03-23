import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { User } from '../models/user.js'
import { RegisterInputSchema, LoginInputSchema } from '@app/types'
import type { JwtPayload } from '../plugins/auth.js'

export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/register
   * Body: { username, email, password, isBreeder? }
   */
  fastify.post('/register', async (req, reply) => {
    // Parse core fields; isBreeder is an optional extra field
    const input = RegisterInputSchema.parse(req.body)
    const isBreeder = Boolean((req.body as Record<string, unknown>).isBreeder ?? false)

    // Check for duplicate username/email
    const existing = await User.findOne({
      $or: [{ username: input.username }, { email: input.email }],
    })
    if (existing) {
      const field = existing.email === input.email ? 'email' : 'username'
      return reply.code(409).send({
        error: 'Conflict',
        message: `${field} is already taken`,
        statusCode: 409,
      })
    }

    const passwordHash = await bcrypt.hash(input.password, 12)
    const user = await User.create({
      username: input.username,
      email: input.email,
      passwordHash,
      isBreeder,
    })

    const payload: Omit<JwtPayload, 'type'> = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
    }

    const accessToken = fastify.jwt.sign({ ...payload, type: 'access' })
    const refreshToken = fastify.signRefreshToken(payload)

    // Persist hashed refresh token
    user.refreshToken = await bcrypt.hash(refreshToken, 10)
    await user.save()

    return reply.code(201).send({
      accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        isBreeder: user.isBreeder,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        location: user.location,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        createdAt: user.createdAt.toISOString(),
      },
    })
  })

  /**
   * POST /api/auth/login
   * Body: { email, password }
   */
  fastify.post('/login', async (req, reply) => {
    const input = LoginInputSchema.parse(req.body)

    const user = await User.findOne({ email: input.email })
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 })
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 })
    }

    const payload: Omit<JwtPayload, 'type'> = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
    }

    const accessToken = fastify.jwt.sign({ ...payload, type: 'access' })
    const refreshToken = fastify.signRefreshToken(payload)

    // Persist hashed refresh token (replaces any previous)
    user.refreshToken = await bcrypt.hash(refreshToken, 10)
    await user.save()

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        isBreeder: user.isBreeder,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        location: user.location,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        createdAt: user.createdAt.toISOString(),
      },
    })
  })

  /**
   * POST /api/auth/refresh
   * Body: { refreshToken }
   */
  fastify.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (!refreshToken) {
      return reply.code(400).send({ error: 'Bad Request', message: 'refreshToken is required', statusCode: 400 })
    }

    let decoded: JwtPayload
    try {
      decoded = fastify.verifyRefreshToken(refreshToken)
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired refresh token', statusCode: 401 })
    }

    if (decoded.type !== 'refresh') {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token type', statusCode: 401 })
    }

    const user = await User.findById(decoded.sub)
    if (!user || !user.refreshToken) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Session not found', statusCode: 401 })
    }

    // Verify the stored hash matches
    const tokenMatch = await bcrypt.compare(refreshToken, user.refreshToken)
    if (!tokenMatch) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Refresh token mismatch', statusCode: 401 })
    }

    const payload: Omit<JwtPayload, 'type'> = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
    }

    const newAccessToken = fastify.jwt.sign({ ...payload, type: 'access' })
    const newRefreshToken = fastify.signRefreshToken(payload)

    // Rotate the refresh token
    user.refreshToken = await bcrypt.hash(newRefreshToken, 10)
    await user.save()

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  /**
   * POST /api/auth/logout
   * Requires: Authorization Bearer <accessToken>
   */
  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as JwtPayload).sub
    await User.findByIdAndUpdate(userId, { refreshToken: null })
    return reply.send({ message: 'Logged out successfully' })
  })

  /**
   * GET /api/auth/me
   * Requires: Authorization Bearer <accessToken>
   */
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as JwtPayload).sub
    const user = await User.findById(userId).select('-passwordHash -refreshToken')
    if (!user) {
      return reply.code(404).send({ error: 'Not Found', message: 'User not found', statusCode: 404 })
    }

    return reply.send({
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      isBreeder: user.isBreeder,
      profilePhoto: user.profilePhoto,
      bio: user.bio,
      location: user.location,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      createdAt: user.createdAt.toISOString(),
    })
  })
}
