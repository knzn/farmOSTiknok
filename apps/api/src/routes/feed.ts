import type { FastifyInstance } from 'fastify'
import { Post } from '../models/post.js'
import { User } from '../models/user.js'
import type { JwtPayload } from '../plugins/auth.js'

function userId(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

export default async function feedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate)

  // ── GET /api/feed ──────────────────────────────────────────────────────
  fastify.get<{ Querystring: { cursor?: string; limit?: string; filter?: string } }>('/', async (req) => {
    const uid = userId(req)
    const limit = Math.min(Number(req.query.limit) || 20, 50)
    const followingOnly = req.query.filter === 'following'

    const query: Record<string, unknown> = {}

    // Following filter — only show posts from users I follow
    if (followingOnly) {
      const me = await User.findById(uid).select('following').lean()
      const followingIds = (me?.following ?? []).map((id: any) => id.toString())
      query.userId = { $in: followingIds }
    }

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
      .populate('userId', 'username profilePhoto isBreeder')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)

    const hasMore = posts.length > limit
    const items = hasMore ? posts.slice(0, limit) : posts

    // Fetch current user's following list once — O(1) lookup per post
    const me = await User.findById(uid).select('following').lean()
    const followingSet = new Set((me?.following ?? []).map((id: any) => id.toString()))

    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]
      nextCursor = Buffer.from(JSON.stringify({
        createdAt: last.createdAt.toISOString(),
        _id: last._id.toString(),
      })).toString('base64')
    }

    return {
      posts: items.map(post => serializePost(post, uid, followingSet)),
      nextCursor,
      hasMore,
    }
  })
}

function serializePost(post: any, currentUserId: string, followingSet: Set<string>) {
  const authorId = post.userId?._id?.toString() ?? post.userId?.toString()
  return {
    id: post._id.toString(),
    author: post.userId?.username ? {
      id: authorId,
      username: post.userId.username,
      profilePhoto: post.userId.profilePhoto,
      isBreeder: post.userId.isBreeder,
      isFollowing: followingSet.has(authorId),
    } : { id: authorId },
    type: post.type,
    mediaUrls: post.mediaUrls,
    thumbnailUrl: post.thumbnailUrl,
    caption: post.caption,
    hashtags: post.hashtags,
    likeCount: post.likes.length,
    liked: post.likes.map((id: any) => id.toString()).includes(currentUserId),
    commentCount: post.commentCount,
    viewCount: post.viewCount,
    createdAt: post.createdAt,
  }
}
