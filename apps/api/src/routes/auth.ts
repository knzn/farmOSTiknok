import type { FastifyInstance, FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { User } from '../models/user.js'
import { LoginEvent } from '../models/loginEvent.js'
import { RegisterInputSchema, LoginInputSchema } from '@app/types'
import type { JwtPayload } from '../plugins/auth.js'
import { sendEmail, passwordResetTemplate } from '../lib/email.js'

function getIp(req: FastifyRequest): string | null {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
    return first?.trim() ?? null
  }
  return req.ip ?? null
}

async function generateTiknokId(): Promise<string> {
  let id: string
  let exists = true
  do {
    const num = Math.floor(10000 + Math.random() * 90000)
    id = `TK-${num}`
    exists = !!(await User.findOne({ tiknokId: id }).lean())
  } while (exists)
  return id
}

// Auto-generate a unique username from a display name
// "Bert Dacles" → "bert_dacles" → "bert_dacles_1" if taken
async function generateUsername(displayName: string): Promise<string> {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 20) || 'user'

  let username = base
  let counter  = 1
  while (await User.findOne({ username }).lean()) {
    username = `${base}_${counter}`
    counter++
  }
  return username
}

// Shared JWT issuer used by both social login endpoints
async function issueSocialJwt(
  fastify: FastifyInstance,
  userId: string,
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessPayload:  JwtPayload = { sub: userId, email, type: 'access' }
  const refreshPayload: JwtPayload = { sub: userId, email, type: 'refresh' }

  const accessToken  = fastify.jwt.sign(accessPayload,  { expiresIn: process.env.JWT_EXPIRES_IN         ?? '15m' })
  const refreshToken = fastify.jwt.sign(refreshPayload, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d' })

  await User.updateOne({ _id: userId }, { refreshToken })

  return { accessToken, refreshToken }
}

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

    // Generate unique TK-XXXXX user ID
    const tiknokId = await generateTiknokId()

    // Trial ends 60 days from now
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 60)

    const user = await User.create({
      username: input.username,
      email: input.email,
      passwordHash,
      isBreeder,
      tiknokId,
      trialEndsAt,
      subscriptionTier: 'free',
      subscriptionStatus: 'trial',
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
        tiknokId: user.tiknokId,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
        paidUntil: user.paidUntil?.toISOString() ?? null,
        isAdmin: user.isAdmin,
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

    // Banned account check
    if (user.isBanned) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: user.banReason
          ? `Your account has been banned: ${user.banReason}`
          : 'Your account has been banned.',
        statusCode: 403,
        code: 'BANNED',
      })
    }

    // Social-only account — no password set
    if (!user.passwordHash) {
      const providers = (user.authProviders ?? []).filter((p: string) => p !== 'local').join(' or ')
      return reply.code(401).send({
        error: 'Unauthorized',
        message: `This account uses ${providers || 'social'} login. Use the social login button instead.`,
        statusCode: 401,
        code: 'SOCIAL_ACCOUNT',
      })
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) {
      // Record failed attempt (fire-and-forget)
      LoginEvent.create({ userId: user._id, ip: getIp(req), userAgent: req.headers['user-agent'] ?? null, method: 'local', success: false }).catch(() => null)
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 })
    }

    // Record successful login (fire-and-forget)
    LoginEvent.create({ userId: user._id, ip: getIp(req), userAgent: req.headers['user-agent'] ?? null, method: 'local', success: true }).catch(() => null)

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
    const user = await User.findById(userId).select('-refreshToken')
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
      tiknokId: user.tiknokId ?? null,
      subscriptionTier: user.subscriptionTier ?? 'free',
      subscriptionStatus: user.subscriptionStatus ?? 'trial',
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      paidUntil: user.paidUntil?.toISOString() ?? null,
      isAdmin: user.isAdmin ?? false,
      hasPassword: !!user.passwordHash,
      accountSecuredAt: user.accountSecuredAt?.toISOString() ?? null,
      mobileNumber: user.mobileNumber ?? null,
      authProviders: user.authProviders ?? ['local'],
      createdAt: user.createdAt.toISOString(),
    })
  })

  /**
   * POST /api/auth/forgot-password
   * Send a password reset link to the user's email.
   * Always returns 200 — never reveals whether the email exists.
   */
  fastify.post('/forgot-password', async (req, reply) => {
    const { email } = req.body as { email?: string }

    if (!email || typeof email !== 'string') {
      return reply.code(400).send({ error: 'Bad Request', message: 'Email is required' })
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() })

    // Always respond the same way — don't reveal if email exists
    if (!user) {
      return reply.send({ success: true })
    }

    // Generate a secure random token — store SHA-256 hash, send plain in email
    const plainToken  = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex')

    user.resetToken          = hashedToken
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await user.save()

    // Deep link opens the TIKNOK app directly on the reset screen
    const resetUrl = `tiknok://reset-password?token=${plainToken}`

    await sendEmail(
      user.email,
      'Reset your TIKNOK password',
      passwordResetTemplate(resetUrl),
    )

    return reply.send({ success: true })
  })

  /**
   * POST /api/auth/reset-password
   * Validate token and set new password.
   */
  fastify.post('/reset-password', async (req, reply) => {
    const { token, password } = req.body as { token?: string; password?: string }

    if (!token || !password) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Token and password are required' })
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Password must be at least 8 characters' })
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiresAt: { $gt: new Date() }, // not expired
    })

    if (!user) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Reset link is invalid or has expired' })
    }

    user.passwordHash        = await bcrypt.hash(password, 12)
    user.resetToken          = null
    user.resetTokenExpiresAt = null
    user.refreshToken        = null  // invalidate all existing sessions
    await user.save()

    return reply.send({ success: true })
  })

  /**
   * POST /api/auth/google
   * Verify a Google access token, find or create user, return JWT.
   * Body: { accessToken: string }
   */
  fastify.post('/google', async (req, reply) => {
    const { accessToken } = req.body as { accessToken?: string }

    if (!accessToken) {
      return reply.code(400).send({ error: 'Bad Request', message: 'accessToken is required' })
    }

    // Verify with Google userinfo endpoint
    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
    )

    if (!googleRes.ok) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid Google token' })
    }

    const googleUser = await googleRes.json() as {
      sub: string        // Google user ID
      email: string
      name: string
      picture?: string
    }

    if (!googleUser.sub) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid Google token' })
    }

    // Find existing user by googleId or email
    let user = await User.findOne({
      $or: [{ googleId: googleUser.sub }, { email: googleUser.email }],
    })

    if (user) {
      // Banned account check for Google sign-in too
      if (user.isBanned) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: user.banReason
            ? `Your account has been banned: ${user.banReason}`
            : 'Your account has been banned.',
          statusCode: 403,
          code: 'BANNED',
        })
      }
      // Link Google to existing account if not already linked
      if (!user.googleId) {
        user.googleId = googleUser.sub
        if (!user.authProviders.includes('google')) user.authProviders.push('google')
        await user.save()
      }
    } else {
      // New user — create account
      const username  = await generateUsername(googleUser.name)
      const tiknokId  = await generateTiknokId()
      const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

      user = await User.create({
        username,
        email:              googleUser.email,
        passwordHash:       null,
        profilePhoto:       googleUser.picture ?? null,
        googleId:           googleUser.sub,
        authProviders:      ['google'],
        tiknokId,
        subscriptionTier:   'free',
        subscriptionStatus: 'trial',
        trialEndsAt,
      })
    }

    const tokens = await issueSocialJwt(fastify, user._id.toString(), user.email)
    // Record Google login (fire-and-forget)
    LoginEvent.create({ userId: user._id, ip: getIp(req), userAgent: req.headers['user-agent'] ?? null, method: 'google', success: true }).catch(() => null)
    return reply.send({ ...tokens, user: { _id: user._id.toString() } })
  })


  /**
   * POST /api/auth/set-password
   * For social-only accounts — add email (if placeholder) + set a password.
   * Requires auth. Marks accountSecuredAt.
   */
  fastify.post('/set-password', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as JwtPayload).sub
    const { password, email, mobileNumber } = req.body as {
      password?: string
      email?: string
      mobileNumber?: string
    }

    if (!password || password.length < 8) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Password must be at least 8 characters' })
    }

    const user = await User.findById(userId)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })

    // Update email if user has a placeholder and a real one is provided
    if (email && user.email.includes('@placeholder.tiknok.com')) {
      const exists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: userId } })
      if (exists) return reply.code(400).send({ error: 'Bad Request', message: 'Email already in use' })
      user.email = email.trim().toLowerCase()
    }

    user.passwordHash     = await bcrypt.hash(password, 12)
    user.accountSecuredAt = new Date()
    if (!user.authProviders.includes('local')) user.authProviders.push('local')
    if (mobileNumber) user.mobileNumber = mobileNumber.trim()

    await user.save()
    return reply.send({ success: true })
  })

  /**
   * POST /api/auth/push-token
   * Save Expo push notification token for the authenticated user.
   */
  fastify.post('/push-token', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as JwtPayload).sub
    const { token } = req.body as { token?: string }

    if (!token || typeof token !== 'string') {
      return reply.code(400).send({ error: 'Bad Request', message: 'token is required' })
    }

    await User.updateOne({ _id: userId }, { expoPushToken: token })
    return reply.send({ success: true })
  })
}
