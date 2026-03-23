/**
 * One-time cleanup script — removes all photo and video posts from the database.
 * Run before going public to clear all development test data.
 *
 * Usage:
 *   cd apps/api
 *   npx ts-node --esm scripts/clear-posts.ts
 *
 * WARNING: This is destructive and irreversible. Back up your DB first.
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not set in apps/api/.env')
  process.exit(1)
}

async function main() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI!)
  console.log('Connected.')

  const db = mongoose.connection.db!

  // Count before
  const postsBefore = await db.collection('posts').countDocuments()
  const commentsBefore = await db.collection('comments').countDocuments()
  console.log(`\nBefore cleanup:`)
  console.log(`  Posts:    ${postsBefore}`)
  console.log(`  Comments: ${commentsBefore}`)

  if (postsBefore === 0 && commentsBefore === 0) {
    console.log('\nNothing to delete. Database is already clean.')
    await mongoose.disconnect()
    return
  }

  // Confirm
  console.log('\nThis will permanently delete ALL posts and comments.')
  console.log('Press Ctrl+C within 5 seconds to cancel...')
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Delete
  const postsResult = await db.collection('posts').deleteMany({})
  const commentsResult = await db.collection('comments').deleteMany({})
  const markingPoolsResult = await db.collection('markingpools').deleteMany({})

  console.log('\nCleanup complete:')
  console.log(`  Posts deleted:        ${postsResult.deletedCount}`)
  console.log(`  Comments deleted:     ${commentsResult.deletedCount}`)
  console.log(`  Marking pools kept:   (not deleted — breeding data is preserved)`)

  // Also reset viewCount / likeCount on any remaining user fields if needed
  console.log('\nDone. Users, seasons, matings, and markings are untouched.')

  await mongoose.disconnect()
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
