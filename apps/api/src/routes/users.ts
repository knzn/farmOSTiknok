import type { FastifyInstance, FastifyReply } from 'fastify'
import { User } from '../models/user.js'
import { Post } from '../models/post.js'
import type { JwtPayload } from '../plugins/auth.js'

function userId(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

function notFound(reply: FastifyReply, msg = 'Not found') {
  return reply.code(404).send({ error: 'Not Found', message: msg, statusCode: 404 })
}

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate)

  // ── PATCH /api/users/me ───────────────────────────────────────────────
  fastify.patch('/me', async (req, reply) => {
    const uid = userId(req)
    const allowed = ['bio', 'location', 'username']
    const body = req.body as Record<string, string>
    const update: Record<string, string> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = String(body[key]).trim()
    }
    if (update.bio && update.bio.length > 150) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Bio max 150 chars', statusCode: 400 })
    }
    if (update.username) {
      if (!/^[a-z0-9_]{3,30}$/.test(update.username)) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Invalid username format', statusCode: 400 })
      }
      const existing = await User.findOne({ username: update.username, _id: { $ne: uid } })
      if (existing) return reply.code(409).send({ error: 'Conflict', message: 'Username taken', statusCode: 409 })
    }
    const user = await User.findByIdAndUpdate(uid, { $set: update }, { new: true })
      .select('-passwordHash -refreshToken')
    return serializeUser(user!, uid)
  })

  // ── POST /api/users/me/cover ──────────────────────────────────────────
  fastify.post('/me/cover', async (req, reply) => {
    const uid = userId(req)
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'Bad Request', message: 'No file', statusCode: 400 })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const buffer = Buffer.concat(chunks)
    const url = await fastify.storage.uploadBuffer(buffer, data.filename || 'cover.jpg', data.mimetype, 'covers')

    const user = await User.findByIdAndUpdate(uid, { coverPhoto: url }, { new: true })
      .select('-passwordHash -refreshToken')
    return serializeUser(user!, uid)
  })

  // ── POST /api/users/me/avatar ─────────────────────────────────────────
  fastify.post('/me/avatar', async (req, reply) => {
    const uid = userId(req)
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'Bad Request', message: 'No file', statusCode: 400 })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const buffer = Buffer.concat(chunks)
    const url = await fastify.storage.uploadBuffer(buffer, data.filename || 'avatar.jpg', data.mimetype, 'avatars')

    const user = await User.findByIdAndUpdate(uid, { profilePhoto: url }, { new: true })
      .select('-passwordHash -refreshToken')
    return serializeUser(user!, uid)
  })

  // ── GET /api/users/:userId ────────────────────────────────────────────
  fastify.get<{ Params: { userId: string } }>('/:userId', async (req, reply) => {
    const user = await User.findById(req.params.userId).select('-passwordHash -refreshToken -email')
    if (!user) return notFound(reply)
    return serializeUser(user, userId(req))
  })

  // ── GET /api/users/search?q=... ───────────────────────────────────────
  fastify.get<{ Querystring: { q?: string } }>('/search', async (req) => {
    const q = req.query.q?.trim()
    if (!q || q.length < 2) return { users: [] }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } },
      ],
    })
      .select('-passwordHash -refreshToken -email')
      .limit(20)

    return { users: users.map(u => serializeUser(u, userId(req))) }
  })

  // ── GET /api/users/:userId/posts ──────────────────────────────────────
  fastify.get<{ Params: { userId: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/:userId/posts',
    async (req) => {
      const uid = userId(req)
      const limit = Math.min(Number(req.query.limit) || 18, 50)
      const query: Record<string, unknown> = { userId: req.params.userId }

      if (req.query.cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(req.query.cursor, 'base64').toString('utf8'))
          query.$or = [
            { createdAt: { $lt: new Date(decoded.createdAt) } },
            { createdAt: new Date(decoded.createdAt), _id: { $lt: decoded._id } },
          ]
        } catch { /* ignore */ }
      }

      const posts = await Post.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)

      const hasMore = posts.length > limit
      const items = hasMore ? posts.slice(0, limit) : posts

      let nextCursor: string | null = null
      if (hasMore && items.length > 0) {
        const last = items[items.length - 1]
        nextCursor = Buffer.from(JSON.stringify({
          createdAt: last.createdAt.toISOString(),
          _id: last._id.toString(),
        })).toString('base64')
      }

      return {
        posts: items.map(p => ({
          id: p._id.toString(),
          thumbnailUrl: p.thumbnailUrl,
          type: p.type,
          likeCount: p.likes.length,
          liked: p.likes.map((id: any) => id.toString()).includes(uid),
          commentCount: p.commentCount,
          createdAt: p.createdAt,
        })),
        nextCursor,
        hasMore,
      }
    },
  )

  // ── POST /api/users/:userId/follow ────────────────────────────────────
  fastify.post<{ Params: { userId: string } }>('/:userId/follow', async (req, reply) => {
    const myId = userId(req)
    if (myId === req.params.userId) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Cannot follow yourself', statusCode: 400 })
    }
    const target = await User.findById(req.params.userId)
    if (!target) return notFound(reply)

    await Promise.all([
      User.findByIdAndUpdate(req.params.userId, { $addToSet: { followers: myId } }),
      User.findByIdAndUpdate(myId, { $addToSet: { following: req.params.userId } }),
    ])
    return { following: true }
  })

  // ── POST /api/users/:userId/unfollow ──────────────────────────────────
  fastify.post<{ Params: { userId: string } }>('/:userId/unfollow', async (req, reply) => {
    const myId = userId(req)
    const target = await User.findById(req.params.userId)
    if (!target) return notFound(reply)

    await Promise.all([
      User.findByIdAndUpdate(req.params.userId, { $pull: { followers: myId } }),
      User.findByIdAndUpdate(myId, { $pull: { following: req.params.userId } }),
    ])
    return { following: false }
  })

  // ── GET /api/users/:userId/followers ──────────────────────────────────
  fastify.get<{ Params: { userId: string } }>('/:userId/followers', async (req, reply) => {
    const myId = userId(req)
    const user = await User.findById(req.params.userId).select('followers')
    if (!user) return notFound(reply)

    const followers = await User.find({ _id: { $in: user.followers } })
      .select('-passwordHash -refreshToken -email')
      .limit(200)

    return { users: followers.map(u => serializeUser(u, myId)) }
  })

  // ── GET /api/users/:userId/following ──────────────────────────────────
  fastify.get<{ Params: { userId: string } }>('/:userId/following', async (req, reply) => {
    const myId = userId(req)
    const user = await User.findById(req.params.userId).select('following')
    if (!user) return notFound(reply)

    const following = await User.find({ _id: { $in: user.following } })
      .select('-passwordHash -refreshToken -email')
      .limit(200)

    return { users: following.map(u => serializeUser(u, myId)) }
  })
}

function serializeUser(user: any, currentUserId: string) {
  return {
    id: user._id.toString(),
    username: user.username,
    profilePhoto: user.profilePhoto,
    coverPhoto: user.coverPhoto ?? null,
    bio: user.bio,
    location: user.location,
    isBreeder: user.isBreeder,
    followerCount: user.followers.length,
    followingCount: user.following.length,
    isFollowing: user.followers.map((id: any) => id.toString()).includes(currentUserId),
    createdAt: user.createdAt,
  }
}
