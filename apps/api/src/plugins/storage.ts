import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable } from 'stream'
import crypto from 'crypto'
import path from 'path'

export interface StorageService {
  uploadBuffer(buffer: Buffer, filename: string, mimetype: string, folder?: string): Promise<string>
  uploadStream(stream: Readable, filename: string, mimetype: string, folder?: string): Promise<string>
  deleteFile(url: string): Promise<void>
}

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageService
  }
}

function generateKey(filename: string, folder: string): string {
  const ext = path.extname(filename) || '.jpg'
  const id = crypto.randomBytes(16).toString('hex')
  return `${folder}/${id}${ext}`
}

export default fp(async function storagePlugin(fastify: FastifyInstance) {
  const {
    DO_SPACES_KEY,
    DO_SPACES_SECRET,
    DO_SPACES_ENDPOINT,
    DO_SPACES_BUCKET,
    DO_SPACES_CDN_URL,
    DO_SPACES_REGION,
  } = process.env

  if (!DO_SPACES_KEY || !DO_SPACES_SECRET || !DO_SPACES_BUCKET) {
    fastify.log.warn('DO Spaces credentials not set — storage plugin disabled')
    fastify.decorate('storage', {
      async uploadBuffer() { return 'https://placehold.co/600x600/1A1A1A/C8A84B?text=No+Storage' },
      async uploadStream() { return 'https://placehold.co/600x600/1A1A1A/C8A84B?text=No+Storage' },
      async deleteFile() {},
    } satisfies StorageService)
    return
  }

  const client = new S3Client({
    endpoint: DO_SPACES_ENDPOINT,
    region: DO_SPACES_REGION || 'sgp1',
    credentials: {
      accessKeyId: DO_SPACES_KEY,
      secretAccessKey: DO_SPACES_SECRET,
    },
    forcePathStyle: false,
  })

  const cdnBase = DO_SPACES_CDN_URL?.replace(/\/$/, '') ?? `https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.digitaloceanspaces.com`

  const storage: StorageService = {
    async uploadBuffer(buffer, filename, mimetype, folder = 'uploads') {
      const key = generateKey(filename, folder)
      await client.send(new PutObjectCommand({
        Bucket: DO_SPACES_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ACL: 'public-read',
      }))
      return `${cdnBase}/${key}`
    },

    async uploadStream(stream, filename, mimetype, folder = 'uploads') {
      const key = generateKey(filename, folder)
      const upload = new Upload({
        client,
        params: {
          Bucket: DO_SPACES_BUCKET,
          Key: key,
          Body: stream,
          ContentType: mimetype,
          ACL: 'public-read',
        },
      })
      await upload.done()
      return `${cdnBase}/${key}`
    },

    async deleteFile(url) {
      const key = url.replace(`${cdnBase}/`, '')
      await client.send(new DeleteObjectCommand({
        Bucket: DO_SPACES_BUCKET,
        Key: key,
      }))
    },
  }

  fastify.decorate('storage', storage)
  fastify.log.info('DO Spaces storage plugin registered')
})
