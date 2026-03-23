import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { Post } from '../models/post.js'
import { Comment } from '../models/comment.js'
import { User } from '../models/user.js'
import type { JwtPayload } from '../plugins/auth.js'

function userId(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

function notFound(reply: FastifyReply, msg = 'Not found') {
  return reply.code(404).send({ error: 'Not Found', message: msg, statusCode: 404 })
}

const CreateCommentSchema = z.object({
  text: z.string().min(1).max(1000).trim(),
})

export default async function postRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate)

  // ── POST /api/posts (multipart — photo upload) ──────────────────────────
  fastify.post('/', async (req, reply) => {
    const parts = req.parts()
    let caption = ''
    let hashtags: string[] = []
    let mediaBuffer: Buffer | null = null
    let mediaFilename = 'upload.jpg'
    let mediaMimetype = 'image/jpeg'

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        mediaBuffer = Buffer.concat(chunks)
        mediaFilename = part.filename || 'upload.jpg'
        mediaMimetype = part.mimetype || 'image/jpeg'
      } else {
        if (part.fieldname === 'caption') caption = String(part.value)
        if (part.fieldname === 'hashtags') {
          try { hashtags = JSON.parse(String(part.value)) } catch { hashtags = [] }
        }
      }
    }

    if (!mediaBuffer) {
      return reply.code(400).send({ error: 'Bad Request', message: 'No file uploaded', statusCode: 400 })
    }

    const url = await fastify.storage.uploadBuffer(mediaBuffer, mediaFilename, mediaMimetype, 'posts')

    // extract hashtags from caption if not provided
    if (hashtags.length === 0) {
      const found = caption.match(/#(\w+)/g)
      if (found) hashtags = found.map(h => h.slice(1).toLowerCase())
    }

    const post = await Post.create({
      userId: userId(req),
      type: 'photo',
      mediaUrls: [url],
      thumbnailUrl: url,
      caption,
      hashtags,
    })

    return reply.code(201).send(serializePost(post, userId(req)))
  })

  // ── POST /api/posts/video (video upload → BullMQ transcode job) ──────
  fastify.post('/video', async (req, reply) => {
    const parts = req.parts()
    let caption = ''
    let hashtags: string[] = []
    let rawVideoUrl: string | null = null
    let filename = 'video.mp4'
    let duration: number | null = null

    for await (const part of parts) {
      if (part.type === 'file') {
        const mime = part.mimetype || ''
        if (!mime.startsWith('video/')) {
          // Drain the stream to avoid hanging the request
          part.file.resume()
          return reply.code(400).send({ error: 'Bad Request', message: 'Uploaded file is not a video', statusCode: 400 })
        }
        filename = part.filename || 'video.mp4'
        rawVideoUrl = await fastify.storage.uploadStream(
          part.file,
          filename,
          mime,
          'raw-videos',
        )
      } else {
        if (part.fieldname === 'caption') caption = String(part.value)
        if (part.fieldname === 'hashtags') {
          try { hashtags = JSON.parse(String(part.value)) } catch { hashtags = [] }
        }
        if (part.fieldname === 'duration') duration = Number(part.value) || null
      }
    }

    if (!rawVideoUrl) {
      return reply.code(400).send({ error: 'Bad Request', message: 'No video uploaded', statusCode: 400 })
    }

    if (hashtags.length === 0) {
      const found = caption.match(/#(\w+)/g)
      if (found) hashtags = found.map(h => h.slice(1).toLowerCase())
    }

    const post = await Post.create({
      userId: userId(req),
      type: 'video',
      mediaUrls: [rawVideoUrl],
      thumbnailUrl: null,
      caption,
      hashtags,
      duration,
      processingStatus: 'pending',
    })

    // rawVideoKey = CDN URL path after base — worker extracts key to download via S3
    await fastify.queues.videoTranscode.add('transcode', {
      postId: post._id.toString(),
      rawVideoKey: rawVideoUrl,  // worker strips CDN prefix to get S3 key
      filename,
    })

    return reply.code(201).send(serializePost(post, userId(req)))
  })

  // ── GET /api/posts/video-feed ─────────────────────────────────────────
  fastify.get<{ Querystring: { cursor?: string; limit?: string } }>(
    '/video-feed',
    async (req) => {
      const uid = userId(req)
      const limit = Math.min(Number(req.query.limit) || 10, 30)
      const query: Record<string, unknown> = { type: 'video', processingStatus: 'ready' }

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
        videos: items.map(p => serializePost(p, uid, followingSet)),
        nextCursor,
      }
    },
  )

  // ── GET /api/posts/search?hashtag=... ────────────────────────────────
  fastify.get<{ Querystring: { hashtag?: string; cursor?: string; limit?: string } }>(
    '/search',
    async (req) => {
      const uid = userId(req)
      const tag = req.query.hashtag?.toLowerCase().replace(/^#/, '').trim()
      if (!tag || tag.length < 1) return { posts: [], nextCursor: null, hasMore: false }

      const limit = Math.min(Number(req.query.limit) || 18, 50)
      const query: Record<string, unknown> = { hashtags: tag }

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
        })),
        nextCursor,
        hasMore,
      }
    },
  )

  // ── GET /api/posts/:postId ────────────────────────────────────────────
  fastify.get<{ Params: { postId: string } }>('/:postId', async (req, reply) => {
    const uid = userId(req)
    const post = await Post.findById(req.params.postId).populate('userId', 'username profilePhoto isBreeder')
    if (!post) return notFound(reply)
    const me = await User.findById(uid).select('following').lean()
    const followingSet = new Set((me?.following ?? []).map((id: any) => id.toString()))
    return serializePost(post, uid, followingSet)
  })

  // ── DELETE /api/posts/:postId ─────────────────────────────────────────
  fastify.delete<{ Params: { postId: string } }>('/:postId', async (req, reply) => {
    const post = await Post.findOne({ _id: req.params.postId, userId: userId(req) })
    if (!post) return notFound(reply)
    for (const url of post.mediaUrls) {
      await fastify.storage.deleteFile(url).catch(() => {})
    }
    await post.deleteOne()
    return reply.code(204).send()
  })

  // ── PATCH /api/posts/:postId (edit caption) ──────────────────────────
  fastify.patch<{ Params: { postId: string }; Body: { caption?: string; hashtags?: string[] } }>(
    '/:postId',
    async (req, reply) => {
      const uid = userId(req)
      const post = await Post.findOne({ _id: req.params.postId, userId: uid })
      if (!post) return notFound(reply)
      if (req.body.caption !== undefined) post.caption = req.body.caption
      if (req.body.hashtags !== undefined) post.hashtags = req.body.hashtags
      await post.save()
      return reply.code(200).send({ ok: true })
    },
  )

  // ── POST /api/posts/:postId/view ─────────────────────────────────────
  fastify.post<{ Params: { postId: string } }>('/:postId/view', async (req, reply) => {
    await Post.findByIdAndUpdate(req.params.postId, { $inc: { viewCount: 1 } })
    return reply.code(204).send()
  })

  // ── POST /api/posts/:postId/like ──────────────────────────────────────
  fastify.post<{ Params: { postId: string } }>('/:postId/like', async (req, reply) => {
    const uid = userId(req)
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { $addToSet: { likes: uid } },
      { new: true },
    )
    if (!post) return notFound(reply)
    return { liked: true, likeCount: post.likes.length }
  })

  // ── POST /api/posts/:postId/unlike ────────────────────────────────────
  fastify.post<{ Params: { postId: string } }>('/:postId/unlike', async (req, reply) => {
    const uid = userId(req)
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { $pull: { likes: uid } },
      { new: true },
    )
    if (!post) return notFound(reply)
    return { liked: false, likeCount: post.likes.length }
  })

  // ── GET /api/posts/:postId/comments ──────────────────────────────────
  fastify.get<{ Params: { postId: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/:postId/comments',
    async (req) => {
      const { postId } = req.params
      const limit = Math.min(Number(req.query.limit) || 20, 50)
      const query: Record<string, unknown> = { postId }
      if (req.query.cursor) query._id = { $lt: req.query.cursor }

      const comments = await Comment.find(query)
        .populate('userId', 'username profilePhoto')
        .sort({ _id: -1 })
        .limit(limit + 1)

      const hasMore = comments.length > limit
      const items = hasMore ? comments.slice(0, limit) : comments
      return {
        comments: items.map(serializeComment),
        nextCursor: hasMore ? items[items.length - 1]._id.toString() : null,
      }
    },
  )

  // ── DELETE /api/posts/:postId/comments/:commentId ────────────────────
  fastify.delete<{ Params: { postId: string; commentId: string } }>(
    '/:postId/comments/:commentId',
    async (req, reply) => {
      const uid = userId(req)
      const comment = await Comment.findOne({ _id: req.params.commentId, postId: req.params.postId })
      if (!comment) return notFound(reply)
      if (comment.userId.toString() !== uid) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Not your comment', statusCode: 403 })
      }
      await comment.deleteOne()
      await Post.findByIdAndUpdate(req.params.postId, { $inc: { commentCount: -1 } })
      return reply.code(204).send()
    },
  )

  // ── POST /api/posts/:postId/comments ─────────────────────────────────
  fastify.post<{ Params: { postId: string } }>('/:postId/comments', async (req, reply) => {
    const { text } = CreateCommentSchema.parse(req.body)
    const post = await Post.findById(req.params.postId)
    if (!post) return notFound(reply)

    const comment = await Comment.create({ postId: req.params.postId, userId: userId(req), text })
    await Post.findByIdAndUpdate(req.params.postId, { $inc: { commentCount: 1 } })

    const populated = await comment.populate('userId', 'username profilePhoto')
    return reply.code(201).send(serializeComment(populated))
  })
}

// ── serializers ──────────────────────────────────────────────────────────────

function serializePost(post: any, currentUserId: string, followingSet: Set<string> = new Set()) {
  const authorId = post.userId?._id?.toString() ?? post.userId?.toString()
  return {
    id: post._id.toString(),
    userId: authorId,
    author: post.userId?.username ? {
      id: authorId,
      username: post.userId.username,
      profilePhoto: post.userId.profilePhoto,
      isBreeder: post.userId.isBreeder,
      isFollowing: followingSet.has(authorId),
    } : undefined,
    type: post.type,
    mediaUrls: post.mediaUrls,
    thumbnailUrl: post.thumbnailUrl,
    caption: post.caption,
    hashtags: post.hashtags,
    likeCount: post.likes.length,
    liked: post.likes.map((id: any) => id.toString()).includes(currentUserId),
    commentCount: post.commentCount,
    viewCount: post.viewCount,
    hlsUrl: post.hlsUrl ?? null,
    duration: post.duration ?? null,
    processingStatus: post.processingStatus ?? null,
    createdAt: post.createdAt,
  }
}

function serializeComment(comment: any) {
  return {
    id: comment._id.toString(),
    postId: comment.postId.toString(),
    userId: comment.userId?._id?.toString() ?? comment.userId?.toString(),
    author: comment.userId?.username ? {
      id: comment.userId._id.toString(),
      username: comment.userId.username,
      profilePhoto: comment.userId.profilePhoto,
    } : undefined,
    text: comment.text,
    createdAt: comment.createdAt,
  }
}
