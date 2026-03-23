/**
 * Seed script — creates a test user and posts 8 gamefowl photos
 * Run: npx tsx scripts/seed-posts.ts
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../src/models/user.js'
import { Post } from '../src/models/post.js'
import bcrypt from 'bcryptjs'

const MONGODB_URI = process.env.MONGODB_URI!

// Public domain rooster/gamefowl images from Wikimedia Commons
const CHICKEN_IMAGES = [
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Rooster_portrait2.jpg/640px-Rooster_portrait2.jpg',
    caption: 'This Sweater bloodline male is ready for the season. Clean feathers, tight body. #sweater #gamefowl #breedingseason',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/White_Leghorn_male.jpg/640px-White_Leghorn_male.jpg',
    caption: 'Pure white Kelso. Grandslam cross from our best broodcock. Looking forward to this generation. #kelso #gamefowl #pureblood',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Brahma_chicken_portrait.jpg/640px-Brahma_chicken_portrait.jpg',
    caption: 'Big body Hatch male. Wide chest, strong legs. This one is going to throw excellent offspring. #hatch #gamefowl #breedingstock',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Bantam_rooster.jpg/640px-Bantam_rooster.jpg',
    caption: 'Roundhead x Lemon 82. The cross that never disappoints. Already 3 derbies deep and still going strong. #roundhead #lemon82 #derby',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/American_game_bantam.jpg/640px-American_game_bantam.jpg',
    caption: 'Grey from a top farm in Batangas. Brought this one home last week. Incredible conditioning already. #grey #gamefowl #breeding',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Domestic_rooster_portrait.jpg/640px-Domestic_rooster_portrait.jpg',
    caption: 'Albany cross. The bloodline speaks for itself. This season we have 6 matings lined up. #albany #gamefowl #season2025',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/White_Leghorn_rooster.jpg/640px-White_Leghorn_rooster.jpg',
    caption: 'Claret male from our friend in Pampanga. Pure Madigin line, 5 generations back. #claret #madigin #gamefowl',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Featherless_chicken.jpg/640px-Featherless_chicken.jpg',
    caption: 'Checking on the chicks today. All markings confirmed and recorded. Another successful season in the books! #markings #breedingrecords #gamefowl',
  },
]

// Fallback to picsum if Wikimedia images fail
const PICSUM_URLS = Array.from({ length: 8 }, (_, i) => ({
  url: `https://picsum.photos/seed/rooster${i + 1}/640/640`,
  caption: CHICKEN_IMAGES[i].caption,
}))

async function seed() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  console.log('Connected.')

  // Create or find test user
  let user = await User.findOne({ username: 'testbreeder' })
  if (!user) {
    console.log('Creating test user: testbreeder / test@tiknok.com / password: Test1234!')
    user = await User.create({
      username: 'testbreeder',
      email: 'test@tiknok.com',
      passwordHash: await bcrypt.hash('Test1234!', 12),
      bio: 'Gamefowl breeder from Cavite. Sweater x Hatch specialist.',
      location: 'Cavite, Philippines',
      isBreeder: true,
    })
    console.log('Test user created.')
  } else {
    console.log(`Found existing user: ${user.username}`)
  }

  // Delete old seed posts for this user (optional — comment out to keep)
  const deleted = await Post.deleteMany({ userId: user._id })
  if (deleted.deletedCount > 0) console.log(`Cleared ${deleted.deletedCount} old seed posts.`)

  // Create posts
  console.log('Creating seed posts...')
  for (let i = 0; i < PICSUM_URLS.length; i++) {
    const { url, caption } = PICSUM_URLS[i]
    const hashtags = (caption.match(/#(\w+)/g) ?? []).map(h => h.slice(1).toLowerCase())

    await Post.create({
      userId: user._id,
      type: 'photo',
      mediaUrls: [url],
      thumbnailUrl: url,
      caption,
      hashtags,
      likes: [],
      commentCount: 0,
      viewCount: Math.floor(Math.random() * 500),
    })
    console.log(`  Post ${i + 1}/8 created`)
  }

  console.log('\n✅ Done! Login with:')
  console.log('   Email:    test@tiknok.com')
  console.log('   Password: Test1234!')
  await mongoose.disconnect()
}

seed().catch(e => { console.error(e); process.exit(1) })
