import 'dotenv/config'
import { Worker, Queue } from 'bullmq'
import { Redis as IORedis } from 'ioredis'
import { Expo } from 'expo-server-sdk'
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import mongoose from 'mongoose'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { createWriteStream, createReadStream } from 'fs'
import { Readable } from 'stream'
import crypto from 'crypto'

// ─── Expo push client ─────────────────────────────────────────────────────────

const expo = new Expo()

async function sendPush(
  token: string | null | undefined,
  title: string,
  body: string,
): Promise<void> {
  if (!token || !Expo.isExpoPushToken(token)) return
  try {
    await expo.sendPushNotificationsAsync([{ to: token, title, body, sound: 'default' }])
  } catch (e) {
    console.warn('[push] Failed to send notification:', (e as Error).message)
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

ffmpeg.setFfmpegPath(ffmpegPath.path)

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const MONGODB_URI = process.env.MONGODB_URI ?? ''

const DO_SPACES_KEY = process.env.DO_SPACES_KEY ?? ''
const DO_SPACES_SECRET = process.env.DO_SPACES_SECRET ?? ''
const DO_SPACES_ENDPOINT = process.env.DO_SPACES_ENDPOINT ?? 'https://sgp1.digitaloceanspaces.com'
const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET ?? ''
const DO_SPACES_CDN_URL = (process.env.DO_SPACES_CDN_URL ?? '').replace(/\/$/, '')
const DO_SPACES_REGION = process.env.DO_SPACES_REGION ?? 'sgp1'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null }) as any

// ─── S3 client ───────────────────────────────────────────────────────────────

const s3 = new S3Client({
  endpoint: DO_SPACES_ENDPOINT,
  region: DO_SPACES_REGION,
  credentials: { accessKeyId: DO_SPACES_KEY, secretAccessKey: DO_SPACES_SECRET },
  forcePathStyle: false,
})

// ─── MongoDB models (minimal, strict: false to avoid full schema duplication) ─

const PostSchema = new mongoose.Schema({
  processingStatus: String,
  hlsUrl: String,
  thumbnailUrl: String,
}, { strict: false })

const Post = mongoose.models.Post ?? mongoose.model('Post', PostSchema)

const UserSchema = new mongoose.Schema({
  subscriptionStatus: String,
  trialEndsAt: Date,
  paidUntil: Date,
  dataDeletesAt: Date,
  subscriptionTier: String,
  expoPushToken: String,
  passwordHash: String,
  accountSecuredAt: Date,
}, { strict: false })

const User = mongoose.models.User ?? mongoose.model('User', UserSchema)

// Minimal models for data deletion
const Season   = mongoose.models.Season   ?? mongoose.model('Season',   new mongoose.Schema({}, { strict: false }))
const Worker   = mongoose.models.Worker   ?? mongoose.model('Worker',   new mongoose.Schema({}, { strict: false }))
const Expense  = mongoose.models.Expense  ?? mongoose.model('Expense',  new mongoose.Schema({}, { strict: false }))
const Mating   = mongoose.models.Mating   ?? mongoose.model('Mating',   new mongoose.Schema({}, { strict: false }))
const MarkingPool = mongoose.models.MarkingPool ?? mongoose.model('MarkingPool', new mongoose.Schema({}, { strict: false }))

async function connectDB() {
  if (!MONGODB_URI) { console.warn('[worker] MONGODB_URI not set — DB updates disabled'); return }
  await mongoose.connect(MONGODB_URI)
  console.log('[worker] MongoDB connected')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cdnUrlToKey(cdnUrl: string): string {
  try {
    return new URL(cdnUrl).pathname.replace(/^\//, '')
  } catch {
    return cdnUrl
  }
}

async function downloadFromSpaces(key: string, localPath: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: DO_SPACES_BUCKET, Key: key }))
  const stream = res.Body as Readable
  await pipeline(stream, createWriteStream(localPath))
}

async function uploadFileToSpaces(localPath: string, key: string, contentType: string): Promise<string> {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: DO_SPACES_BUCKET,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: contentType,
      ACL: 'public-read',
    },
  })
  await upload.done()
  const cdnBase = DO_SPACES_CDN_URL || `https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.digitaloceanspaces.com`
  return `${cdnBase}/${key}`
}

async function uploadDirToSpaces(localDir: string, s3Prefix: string): Promise<void> {
  const files = fs.readdirSync(localDir)
  for (const file of files) {
    const localPath = path.join(localDir, file)
    if (fs.statSync(localPath).isDirectory()) {
      await uploadDirToSpaces(localPath, `${s3Prefix}/${file}`)
      continue
    }
    const ext = path.extname(file)
    const contentType = ext === '.m3u8' ? 'application/vnd.apple.mpegurl'
      : ext === '.ts' ? 'video/mp2t'
      : ext === '.jpg' ? 'image/jpeg'
      : 'application/octet-stream'
    const key = `${s3Prefix}/${file}`
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: DO_SPACES_BUCKET,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentType,
        ACL: 'public-read',
      },
    })
    await upload.done()
  }
}

// ─── Extract thumbnail ────────────────────────────────────────────────────────

async function extractThumbnail(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(1)
      .frames(1)
      .outputOptions(['-map 0:v:0'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run()
  })
}

// ─── Transcode to HLS ────────────────────────────────────────────────────────

async function transcodeToHLS(inputPath: string, outputDir: string): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true })

  const stderrLines: string[] = []
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-map 0:v:0',
        '-map 0:a:0?',
        '-vcodec libx264',
        '-acodec aac',
        '-crf 18',
        '-preset fast',
        '-b:a 192k',
        '-vf scale=\'if(gt(iw,ih),min(iw\\,1920),-2):if(gt(iw,ih),-2,min(ih\\,1920))\'',
        '-pix_fmt yuv420p',
        '-profile:v main',
        '-level 4.0',
        '-start_number 0',
        '-hls_time 6',
        '-hls_list_size 0',
        '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'),
        '-f hls',
      ])
      .output(path.join(outputDir, 'playlist.m3u8'))
      .on('start', cmd => console.log('[ffmpeg] command:', cmd))
      .on('stderr', (line: string) => stderrLines.push(line))
      .on('progress', p => console.log(`[ffmpeg] ${Math.round(p.percent ?? 0)}%`))
      .on('end', () => resolve())
      .on('error', (err: Error) => {
        console.error('[ffmpeg] stderr:\n' + stderrLines.slice(-20).join('\n'))
        reject(new Error(`FFmpeg failed: ${err.message}`))
      })
      .run()
  })
}

// ─── Main transcode handler ───────────────────────────────────────────────────

interface VideoTranscodeJobData {
  postId: string
  rawVideoKey: string  // CDN URL of raw video
  filename: string
}

async function handleTranscode(data: VideoTranscodeJobData): Promise<void> {
  const { postId, rawVideoKey, filename } = data
  const tmpId = crypto.randomBytes(8).toString('hex')
  const tmpDir = path.join(os.tmpdir(), `tiknok_${tmpId}`)
  const inputExt = path.extname(filename) || '.mp4'
  const inputPath = path.join(tmpDir, `input${inputExt}`)
  const hlsDir = path.join(tmpDir, 'hls')
  const thumbPath = path.join(tmpDir, 'thumbnail.jpg')

  try {
    fs.mkdirSync(tmpDir, { recursive: true })

    // Mark post as processing
    await Post.findByIdAndUpdate(postId, { processingStatus: 'processing' })
    console.log(`[worker] Processing post ${postId}`)

    // Download raw video from Spaces
    const s3Key = cdnUrlToKey(rawVideoKey)
    console.log(`[worker] Downloading ${s3Key}`)
    await downloadFromSpaces(s3Key, inputPath)

    // Extract thumbnail (best-effort — may fail on some inputs)
    console.log('[worker] Extracting thumbnail...')
    try {
      await extractThumbnail(inputPath, thumbPath)
    } catch (e) {
      console.warn('[worker] Thumbnail extraction failed (non-fatal):', (e as Error).message)
    }

    // Transcode to HLS
    console.log('[worker] Transcoding to HLS...')
    await transcodeToHLS(inputPath, hlsDir)

    // Upload HLS segments to Spaces
    const hlsPrefix = `hls/${postId}`
    console.log(`[worker] Uploading HLS to ${hlsPrefix}`)
    await uploadDirToSpaces(hlsDir, hlsPrefix)

    const cdnBase = DO_SPACES_CDN_URL || `https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.digitaloceanspaces.com`
    const hlsUrl = `${cdnBase}/${hlsPrefix}/playlist.m3u8`

    // Upload thumbnail only if it was successfully generated
    let thumbnailUrl: string | null = null
    if (fs.existsSync(thumbPath)) {
      const thumbKey = `hls/${postId}/thumbnail.jpg`
      thumbnailUrl = await uploadFileToSpaces(thumbPath, thumbKey, 'image/jpeg')
      console.log('[worker] Thumbnail uploaded:', thumbnailUrl)
    } else {
      console.warn('[worker] No thumbnail generated — skipping thumbnail upload')
    }

    // Update post with HLS URL
    await Post.findByIdAndUpdate(postId, {
      hlsUrl,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      processingStatus: 'ready',
    })

    console.log(`[worker] Done: post ${postId} → ${hlsUrl}`)
  } finally {
    // Cleanup temp files
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

// ─── Workers ──────────────────────────────────────────────────────────────────

const videoWorker = new Worker<VideoTranscodeJobData>(
  'video.transcode',
  async (job) => {
    if (!MONGODB_URI) {
      console.warn('[worker] MONGODB_URI not set — skipping transcode')
      return
    }
    if (!DO_SPACES_KEY || !DO_SPACES_BUCKET) {
      console.warn('[worker] DO Spaces not configured — skipping transcode')
      return
    }
    await handleTranscode(job.data)
  },
  { connection, concurrency: 2 },
)

const aiWorker = new Worker(
  'ai.job',
  async (job) => {
    console.log(`[ai.job] Processing job ${job.id}`, job.data)
    // Phase 2/3: HTTP call to AI microservice here
  },
  { connection },
)

videoWorker.on('completed', (job) => console.log(`[video] done: ${job.id}`))
videoWorker.on('failed', (job, err) => console.error(`[video] failed: ${job?.id}`, err.message))
aiWorker.on('completed', (job) => console.log(`[ai] done: ${job.id}`))
aiWorker.on('failed', (job, err) => console.error(`[ai] failed: ${job?.id}`, err))

// ─── Subscription cron ────────────────────────────────────────────────────────

const subscriptionQueue = new Queue('subscription.cron', { connection })

// Handler: run subscription lifecycle checks
async function handleSubscriptionCron(): Promise<void> {
  if (!MONGODB_URI) return
  const now = new Date()

  // ── 1. Expire trials that have ended ──────────────────────────────────────
  const expiredTrials = await User.find({
    subscriptionStatus: 'trial',
    trialEndsAt: { $lt: now },
  }).lean()

  for (const user of expiredTrials) {
    const dataDeletesAt = new Date(now)
    dataDeletesAt.setMonth(dataDeletesAt.getMonth() + 6)
    await User.updateOne(
      { _id: user._id },
      { subscriptionStatus: 'expired', subscriptionTier: 'free', dataDeletesAt },
    )
    console.log(`[subscription] Trial expired: ${user._id} — data deletes at ${dataDeletesAt.toISOString()}`)
  }

  // ── 2. Expire active subscriptions that have ended ────────────────────────
  const expiredSubs = await User.find({
    subscriptionStatus: 'active',
    paidUntil: { $lt: now },
  }).lean()

  for (const user of expiredSubs) {
    const dataDeletesAt = new Date(now)
    dataDeletesAt.setMonth(dataDeletesAt.getMonth() + 6)
    await User.updateOne(
      { _id: user._id },
      { subscriptionStatus: 'expired', subscriptionTier: 'free', dataDeletesAt },
    )
    console.log(`[subscription] Subscription expired: ${user._id}`)
  }

  // ── 3. Warn users 30 days before data deletion ────────────────────────────
  const warn30 = new Date(now)
  warn30.setDate(warn30.getDate() + 30)
  const warn30Start = new Date(warn30)
  warn30Start.setHours(0, 0, 0, 0)
  const warn30End = new Date(warn30)
  warn30End.setHours(23, 59, 59, 999)

  const usersWarn30 = await User.find({
    subscriptionStatus: 'expired',
    dataDeletesAt: { $gte: warn30Start, $lte: warn30End },
  }).lean()

  for (const user of usersWarn30) {
    console.log(`[subscription] WARNING 30d: user ${user._id} data deletes in 30 days`)
    await sendPush(
      user.expoPushToken,
      '⚠️ Your farm data will be deleted in 30 days',
      'Subscribe to TIKNOK to keep your breeding records. ₱50/month or ₱499/year.',
    )
  }

  // ── 4. Warn users 7 days before data deletion ─────────────────────────────
  const warn7 = new Date(now)
  warn7.setDate(warn7.getDate() + 7)
  const warn7Start = new Date(warn7)
  warn7Start.setHours(0, 0, 0, 0)
  const warn7End = new Date(warn7)
  warn7End.setHours(23, 59, 59, 999)

  const usersWarn7 = await User.find({
    subscriptionStatus: 'expired',
    dataDeletesAt: { $gte: warn7Start, $lte: warn7End },
  }).lean()

  for (const user of usersWarn7) {
    console.log(`[subscription] WARNING 7d: user ${user._id} data deletes in 7 days`)
    await sendPush(
      user.expoPushToken,
      '🚨 7 days until your farm data is deleted',
      'Subscribe now to save your breeding records. Contact us on Messenger.',
    )
  }

  // ── 5. Nudge social users to secure their account (Day 5 after register) ───
  const day5Start = new Date(now)
  day5Start.setDate(day5Start.getDate() - 5)
  day5Start.setHours(0, 0, 0, 0)
  const day5End = new Date(day5Start)
  day5End.setHours(23, 59, 59, 999)

  const unsecuredSocialUsers = await User.find({
    createdAt: { $gte: day5Start, $lte: day5End },
    passwordHash: null,           // social-only (no password set)
    accountSecuredAt: null,       // not yet secured
    expoPushToken: { $ne: null },
  }).lean()

  for (const user of unsecuredSocialUsers) {
    await sendPush(
      user.expoPushToken,
      '🔐 Secure your TIKNOK account',
      'Add an email and password so you never lose access to your breeding records.',
    )
    console.log(`[security] Day-5 nudge sent to user ${user._id}`)
  }

  // ── 6. Delete data for accounts past dataDeletesAt ────────────────────────
  const usersToDelete = await User.find({
    subscriptionStatus: 'expired',
    dataDeletesAt: { $lt: now },
  }).lean()

  for (const user of usersToDelete) {
    const userId = user._id
    await Promise.all([
      Season.deleteMany({ userId }),
      Mating.deleteMany({ userId }),
      MarkingPool.deleteMany({ userId }),
      Worker.deleteMany({ userId }),
      Expense.deleteMany({ userId }),
    ])
    // Clear dataDeletesAt so we don't re-process, mark as cleaned
    await User.updateOne({ _id: userId }, { dataDeletesAt: null })
    console.log(`[subscription] Data deleted for user ${userId}`)
  }

  console.log(`[subscription] Cron complete — checked ${expiredTrials.length + expiredSubs.length} expired, deleted ${usersToDelete.length}`)
}

const subscriptionWorker = new Worker(
  'subscription.cron',
  async () => { await handleSubscriptionCron() },
  { connection },
)

subscriptionWorker.on('completed', () => console.log('[subscription] Cron job completed'))
subscriptionWorker.on('failed', (job, err) => console.error('[subscription] Cron job failed:', err.message))

// ─── Boot ─────────────────────────────────────────────────────────────────────

await connectDB()

// Schedule subscription cron — runs daily at midnight (if not already scheduled)
const existingJobs = await subscriptionQueue.getRepeatableJobs()
const alreadyScheduled = existingJobs.some((j) => j.name === 'daily-subscription-check')
if (!alreadyScheduled) {
  await subscriptionQueue.add(
    'daily-subscription-check',
    {},
    { repeat: { pattern: '0 0 * * *' } }, // every day at midnight
  )
  console.log('[subscription] Daily cron scheduled')
}

console.log('Worker started. Listening for jobs...')
