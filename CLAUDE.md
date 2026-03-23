# CLAUDE.md — TIKNOK App
> This file is the source of truth for every AI coding session.
> Read this ENTIRE file before writing a single line of code.
> Never deviate from decisions made here without explicit instruction from the owner.

---

## WHAT WE ARE BUILDING

**TIKNOK** — a **Farm Management Operating System for Filipino gamefowl breeders.**

Not a social media app. Not a TikTok clone. Not an Instagram clone.
The one tool a serious breeder needs to run their entire operation.

**Core value:** A breeder opens this app every day to manage their farm — breeding records, bird profiles, inventory, feed budget, worker costs, derby schedule, and performance analytics. Everything in one place, private and secure.

**App name:** TIKNOK

---

## STRATEGIC DECISIONS (locked in — do not re-litigate)

### What this app IS
A farm management OS. The private tool every serious breeder needs.

### What this app is NOT
- **NOT a video platform on mobile** — App Store/Play Store ban risk for cockfighting content
- **NOT competing with Facebook for photos** — Filipino breeders will never leave FB for photos
- **NOT a bird marketplace** — Facebook Marketplace already owns that in PH

### The moat (what Facebook can never build)
- **Marking Generator** — no other platform has this
- **Bird Profiles + Lineage Tree** — digital pedigree system, shareable to FB/Viber
- **Farm OS** — inventory, feed calc, workers, performance — no other platform has this
- **Derby registration + results linked to bird profiles** — no other platform has this

### Photos (Instanok) — built but hidden
Phase 2 code stays in codebase but hidden from tab bar.
Filipino breeders will never leave Facebook for photos. Not worth competing.
May be revisited post-launch if community requests it.

### Videos (Tiknok) — web only
Mobile tab hidden (href: null). Video infrastructure built in Phase 3 (backend only).
Video lives on the Web App (Phase 8) — no App Store content restrictions there.

---

## TECH STACK

| Layer | Technology | Notes |
|---|---|---|
| Mobile | React Native + Expo (SDK 51+) | Primary platform. EAS Build for releases. |
| Web | Next.js 14+ (App Router) | Videos live here. Same API. Built after mobile. |
| API | Node.js + Fastify (v4) | TypeScript. REST + WebSockets. |
| Shared types | TypeScript + Turborepo monorepo | Shared across mobile, web, API |
| Video processing | FFmpeg worker | HLS transcode. DO NOT DELETE. Web-only feature. |
| AI microservice | Python 3.11 + FastAPI | Separate Docker container. Heavy ML only. |
| Job queue | BullMQ + Redis 7 | Transcoding, push notifications, cron jobs |
| Database | MongoDB Atlas | M0 free tier for dev. M10+ for production. |
| Object storage | DigitalOcean Spaces | S3-compatible. Raw uploads + HLS segments. |
| CDN | DO Spaces CDN | Serves HLS video segments globally. |
| Auth | JWT + bcrypt | Self-hosted. Access + refresh token rotation. |
| Real-time | Socket.io | Notifications, live feed updates. |
| Local dev | Docker Compose | Runs API, worker, AI, Redis locally. MongoDB = Atlas even in dev. |
| Production | DigitalOcean | Droplet + DO App Platform + Atlas (external) |

---

## MONOREPO STRUCTURE

```
/
├── apps/
│   ├── mobile/               # React Native + Expo
│   │   ├── app/              # Expo Router file-based navigation
│   │   ├── components/       # App-specific components
│   │   ├── hooks/            # Custom hooks
│   │   ├── stores/           # Zustand state stores
│   │   └── lib/              # API client, utils
│   ├── web/                  # Next.js 14 (App Router) — video lives here
│   └── api/                  # Node.js + Fastify
│       ├── src/
│       │   ├── routes/       # Fastify route handlers
│       │   ├── plugins/      # Fastify plugins (auth, db, storage, queue)
│       │   ├── services/     # Business logic
│       │   └── lib/          # Shared utilities
│       └── Dockerfile
├── services/
│   ├── worker/               # BullMQ + FFmpeg HLS transcoding — DO NOT DELETE
│   │   └── Dockerfile
│   └── ai/                   # Python FastAPI AI microservice
│       ├── main.py
│       └── Dockerfile
├── packages/
│   ├── types/                # Shared TypeScript types + Zod schemas
│   ├── marking-engine/       # Marking algorithm (pure TS, unit tested) — COMPLETE
│   └── ui/                   # Shared RN + web components (future)
├── docker-compose.yml
├── turbo.json
└── CLAUDE.md
```

---

## UI / UX SYSTEM

### Theme
- Dark mode is the primary design target.
- Both dark and light mode supported via NativeWind `dark:` variants.

### Color Palette
```
Background primary:    #0A0A0A  (dark) / #FFFFFF  (light)
Background secondary:  #141414  (dark) / #F5F5F5  (light)
Background tertiary:   #1E1E1E  (dark) / #EBEBEB  (light)
Surface / card:        #141414  (dark) / #FAFAFA  (light)
Border:                #2A2A2A  (dark) / #E0E0E0  (light)

Text primary:          #FFFFFF  (dark) / #0A0A0A  (light)
Text secondary:        #A0A0A0  (dark) / #606060  (light)
Text tertiary:         #606060  (dark) / #A0A0A0  (light)

Accent (brand):        #C8A84B  (gold — gamefowl heritage)
Accent hover:          #D4B96A
Accent muted:          #C8A84B33  (10% opacity)

Success:               #22C55E
Warning:               #F59E0B
Danger:                #EF4444
Info:                  #3B82F6
```

### Typography
```
Font family:  System default (San Francisco iOS, Roboto Android)
Sizes:  xs=11px  sm=13px  base=15px  lg=17px  xl=20px  2xl=24px  3xl=30px
Weights:  400 / 500 / 600 / 700
Line height:  1.4 body  /  1.2 headings
```

### Spacing & Radius
```
Spacing:  1=4px  2=8px  3=12px  4=16px  5=20px  6=24px  8=32px
Radius:   sm=4px  md=8px  lg=12px  xl=16px  full=9999px
```

### Component Library
- **NativeWind v4** — all styling via Tailwind classes. No StyleSheet.create. No inline style objects. Exception: Reanimated animated styles.
- **Expo Router v3** — file-based navigation
- **React Native Reanimated 3** — all animations
- **React Native Gesture Handler** — swipe, pull-to-refresh, long press
- **FlashList** — all lists and feeds. Never FlatList.
- **Expo Image** — all images with blurhash placeholders
- **SimpleBottomSheet** — custom bottom sheet (no @gorhom — worklets issue in Expo Go)

### Navigation Structure
```
Root Stack
├── (auth)/                    # Login, Register
└── (app)/                     # Protected routes
    ├── _layout.tsx            # Bottom Tab Bar (5 tabs)
    ├── index.tsx              # Home — Farm Dashboard
    ├── breeder/               # Farm OS — all farm management tools
    │   ├── _layout.tsx
    │   ├── index.tsx          # Farm OS hub (list of all modules)
    │   ├── marking-generator/ # Breeding seasons + markings (BUILT)
    │   ├── inventory.tsx      # Bird inventory counts (BUILT)
    │   ├── feed-calculator.tsx # Feed budget calculator (BUILT)
    │   ├── workers.tsx        # Worker management (BUILT)
    │   ├── performance.tsx    # Win/loss analytics (BUILT)
    │   └── birds/             # Bird profiles + lineage tree (Phase 5f/5g)
    ├── schedule/              # Derby event calendar (Phase 6)
    │   └── index.tsx
    ├── explore/               # Breeder/bloodline discovery (Phase 7)
    │   └── index.tsx
    ├── profile/
    │   └── [userId].tsx
    └── notifications.tsx

    Hidden routes (code preserved, href: null):
    ├── create.tsx             # Photo post creation (hidden — photos deprioritized)
    ├── tiknok.tsx             # Video feed (web-only)
    └── (old explore.tsx)      # Instanok photo feed — hidden, code preserved
```

### Bottom Tab Bar
```
[ Home ] [ Farm OS ] [ Schedule ] [ Explore ] [ Profile ]
```
- **Home** — Farm Dashboard (all metrics at a glance)
- **Farm OS** — all farm management tools
- **Schedule** — derby events, registration, results
- **Explore** — discover breeders, bloodlines, farms, top performers
- **Profile** — public breeder profile
- Active tab: gold accent (#C8A84B)
- Tab bar: #0A0A0A background, #2A2A2A top border, 68px height
- NO create (+) button — photos are deprioritized

### Dashboard Home Screen Layout
```
┌─────────────────────────────────────┐
│  TIKNOK    [Good morning, username] │
├─────────────────────────────────────┤
│  BREEDING — active season card      │
│  [Season name] [Matings] [Status]   │
├─────────────────────────────────────┤
│  FARM INVENTORY                     │
│  Stags · Cocks · Pullets · Chicks  │
├─────────────────────────────────────┤
│  FEED BUDGET                        │
│  X kg/day · ₱X/month               │
├─────────────────────────────────────┤
│  WORKERS                            │
│  X workers · ₱X / month            │
├─────────────────────────────────────┤
│  PERFORMANCE                        │
│  W: X  L: X  Rate: X%              │
│  Best stag: [name]                  │
│  [Upcoming derby if any]            │
└─────────────────────────────────────┘
```
- Each card taps to the full module screen
- Pull to refresh
- Empty state per card with "Set Up" CTA
- Single `GET /api/dashboard` call on mount

### Sheets and Modals
- All bottom sheets use SimpleBottomSheet (custom component)
- Drag handle at top, 12px border radius
- Never use Alert.alert for app UI — use custom sheet or modal
- Sheet snaps: 72% for forms, 90% for detail views, 45% for simple prompts

---

## VIDEO AUTO-LOGIN HANDOFF (Mobile → Web)

When user taps Videos on web or from mobile link:
1. Mobile calls `POST /api/auth/web-token` — returns a 60-second one-time token
2. Mobile opens browser: `https://tiknok.com/videos?wt=<token>`
3. Web validates token → exchanges for full session → auto-logged in
4. Token stored in Redis with 60s TTL, deleted on first use. Never in MongoDB.

---

## FARM OS — PRIVACY RULE

100% private. Only the authenticated owner sees their own farm data.
Every API query MUST filter by `userId: req.user._id`. Enforced at API layer.
Nothing from Farm OS ever appears in any public feed or public API endpoint.

---

## DATA MODELS

### User (existing)
```typescript
{
  _id: ObjectId
  username: string
  email: string
  passwordHash: string
  profilePhoto: string | null
  coverPhoto: string | null
  bio: string
  location: string
  farmName: string | null         // breeder's farm name
  region: string | null           // Philippine province/region
  isBreeder: boolean
  subscriptionTier: 'free' | 'pro'  // Phase 9
  followers: ObjectId[]
  following: ObjectId[]
  createdAt: Date
  updatedAt: Date
}
```

### BreedingSeason (existing + lifecycle fields)
```typescript
{
  _id: ObjectId
  userId: ObjectId
  name: string
  year: number
  markingsGenerated: boolean
  generatedAt: Date | null
  // Lifecycle fields (Phase 5e)
  eggsLaid: number | null
  expectedHatchDate: Date | null    // auto: eggsLaidDate + 21 days
  chicksHatched: number | null
  hatchRate: number | null          // auto: chicksHatched / eggsLaid * 100
  maleCount: number | null
  femaleCount: number | null
  sexCountDone: boolean
  sexCountUpdatedAt: Date | null
  notificationJobIds: string[]      // BullMQ job IDs for reminder chain
  createdAt: Date
  updatedAt: Date
}
```

### Mating (existing — no changes)
Egg/hatch/sex data lives on the Season level. Individual bird records in FightRecord.

### MarkingPool (existing — no changes)

### FarmInventory (BUILT)
```typescript
{
  _id: ObjectId
  userId: ObjectId           // unique — one doc per user
  broodCocks: number         // males used for breeding only
  broodHens: number          // active breeding females
  stags: number              // adult males in conditioning
  pullets: number            // young pre-brood females
  chicks: number             // unweaned / unsexed
  others: number             // any other birds
  notes: string | null
  updatedAt: Date
}
```
Note: current implementation uses `cocks` instead of `broodCocks`. Rename in Phase 5a fix.

### FeedProgram (BUILT — fix fastingDaysPerWeek)
```typescript
{
  _id: ObjectId
  userId: ObjectId           // unique — one doc per user
  gramsPerFeeding: number    // e.g. 40
  feedingsPerDay: number     // 1 or 2
  fastingDaysPerWeek: number // 0, 1, or 2 (boolean in current build — fix to number)
  costPerKgPhp: number       // local feed price
  currency: string           // 'PHP' default
  updatedAt: Date
}
```

### Worker (BUILT)
```typescript
{
  _id: ObjectId
  userId: ObjectId
  name: string
  role: string | null
  payType: 'daily' | 'monthly'
  payAmount: number
  currency: string
  isActive: boolean
  notes: string | null
  createdAt: Date
}
```

### FightRecord (BUILT)
```typescript
{
  _id: ObjectId
  userId: ObjectId
  stagName: string
  bloodline: string | null
  marking: string | null          // e.g. 'LN-RI' from marking system
  birdId: ObjectId | null         // link to Bird profile (Phase 5f)
  matingId: ObjectId | null
  derbyEventId: ObjectId | null
  result: 'win' | 'loss' | 'draw' | 'cancelled'
  weightClass: string | null
  venue: string | null
  fightDate: Date
  notes: string | null
  createdAt: Date
}
```

### Bird (Phase 5f — NEW)
```typescript
{
  _id: ObjectId
  userId: ObjectId
  name: string
  bloodline: string
  color: string | null
  weightClass: string | null
  markingCode: string | null       // from marking system e.g. 'LN-RI'
  matingId: ObjectId | null        // which mating produced this bird
  henName: string | null           // which hen (by name) is the mother
  fatherId: ObjectId | null        // sire — links to another Bird document
  motherId: ObjectId | null        // dam — links to another Bird document
  photos: string[]                 // DO Spaces URLs
  status: 'active' | 'retired' | 'sold' | 'deceased'
  isPublic: boolean                // breeder controls public visibility
  wins: number                     // auto-updated when FightRecord saved
  losses: number
  draws: number
  createdAt: Date
  updatedAt: Date
}
```

### DerbyEvent (Phase 6 — NEW)
```typescript
{
  _id: ObjectId
  createdBy: ObjectId
  title: string
  venue: string
  location: string
  region: string
  date: Date
  weightClasses: string[]
  entryFee: number
  currency: string
  rsvps: ObjectId[]
  entries: Array<{
    userId: ObjectId
    birdId: ObjectId
    weightClass: string
    confirmed: boolean
  }>
  resultsPosted: boolean
  createdAt: Date
}
```

### Post (existing — photos/video, hidden on mobile)
```typescript
{
  _id: ObjectId
  userId: ObjectId
  type: 'photo' | 'video'
  mediaUrls: string[]
  thumbnailUrl: string
  caption: string
  hashtags: string[]
  taggedUsers: ObjectId[]
  likes: ObjectId[]
  commentCount: number
  viewCount: number
  hlsUrl: string | null           // video only — DO NOT DELETE
  duration: number | null         // video only
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed' | null
  visibility: 'public' | 'unlisted' | 'private'
  createdAt: Date
}
```

---

## API ROUTES

### Auth (existing + planned)
```
POST  /api/auth/register
POST  /api/auth/login
POST  /api/auth/refresh
POST  /api/auth/logout
GET   /api/auth/me
POST  /api/auth/web-token        Generate 60s handoff token for web auto-login
GET   /api/auth/web-token/:token Web validates token, returns session
```

### Dashboard (BUILT)
```
GET   /api/dashboard             All metrics in one call (auth required)
```

### Breeding / Marking Generator (BUILT + extend)
```
POST/GET/PATCH/DELETE  /api/seasons
POST/GET/PATCH/DELETE  /api/seasons/:seasonId/matings
POST   /api/seasons/:seasonId/generate
POST   /api/seasons/:seasonId/generate/confirm
POST   /api/seasons/:seasonId/generate/swap
DELETE /api/seasons/:seasonId/generate
PATCH  /api/seasons/:seasonId/lifecycle    Phase 5e — update eggs/hatch/sex data
```

### Farm OS (BUILT)
```
GET  /api/farm/inventory
PUT  /api/farm/inventory
GET  /api/farm/feed-program
PUT  /api/farm/feed-program
GET  /api/farm/feed-calculator
POST /api/farm/workers
GET  /api/farm/workers
PATCH /api/farm/workers/:id
DELETE /api/farm/workers/:id
POST  /api/farm/fights
GET   /api/farm/fights
GET   /api/farm/fights/summary
PATCH /api/farm/fights/:id
DELETE /api/farm/fights/:id
```

### Bird Profiles (Phase 5f)
```
POST  /api/birds                 Create bird profile
GET   /api/birds                 List my birds (filter: status, bloodline)
GET   /api/birds/:id             Get bird (public if isPublic, auth if private)
PATCH /api/birds/:id             Update bird
DELETE /api/birds/:id            Soft delete (set status: deceased/sold)
```

### Derby Schedule (Phase 6)
```
POST  /api/derbies               Create event
GET   /api/derbies               List upcoming events (public)
GET   /api/derbies/:id           Event detail
PATCH /api/derbies/:id           Update event (owner only)
POST  /api/derbies/:id/rsvp      RSVP
POST  /api/derbies/:id/enter     Register a bird for the derby
POST  /api/derbies/:id/results   Post results → auto-creates FightRecords
```

### Explore (Phase 7)
```
GET   /api/explore/breeders      Search breeders (name, farm, bloodline, region)
GET   /api/explore/bloodlines    Full bloodline directory
GET   /api/explore/leaderboard   Top breeders by win rate (current season)
GET   /api/explore/birds         Public bird search by bloodline + region
```

### Posts / Photos (existing — hidden on mobile, intact for web)
```
POST  /api/posts
GET   /api/posts/:postId
DELETE /api/posts/:postId
PATCH /api/posts/:postId
POST  /api/posts/:postId/like
POST  /api/posts/:postId/unlike
GET   /api/posts/:postId/comments
POST  /api/posts/:postId/comments
GET   /api/feed
POST  /api/posts/video           Web only
GET   /api/posts/video-feed      Web only
POST  /api/posts/:id/view        Web only
```

### Users / Social (existing)
```
GET   /api/users/:id
GET   /api/users/search
POST  /api/users/:id/follow
POST  /api/users/:id/unfollow
GET   /api/users/:id/followers
GET   /api/users/:id/following
GET   /api/users/:id/posts
PATCH /api/users/me
POST  /api/users/me/avatar
POST  /api/users/me/cover
```

---

## CODING RULES

1. **TypeScript everywhere.** No plain `.js` files. Strict mode on.
2. **Zod for all validation.** Every API input validated with Zod. Never use `any`.
3. **Never trust the client.** All `userId` filtering server-side. Always use `req.user._id` from JWT.
4. **marking-engine is pure.** No DB calls, no HTTP. Input in → output out.
5. **Conflict validation runs twice.** Client-side + server-side (400 error).
6. **Bottom sheets not pages.** Simple forms and confirmations = bottom sheets.
7. **Nothing from Farm OS on the feed.** Zero farm data in public API.
8. **Video infrastructure stays.** Never delete video upload routes, worker, or FFmpeg code.
9. **Chunked uploads.** Large file uploads use multipart. Never buffer entire file in API memory.
10. **Monorepo imports.** Use `@app/types`, `@app/marking-engine` workspace aliases.
11. **NativeWind only for styling.** No StyleSheet.create. No inline style objects. Exception: Reanimated animated styles.
12. **FlashList not FlatList.** All lists use FlashList.
13. **Expo Router file-based navigation.** No React Navigation setup.
14. **Cursor-based pagination everywhere.** Never offset/page pagination.
15. **One dashboard API call.** Home screen loads all metrics in a single `GET /api/dashboard`.
16. **No ads in Farm OS tools.** Ads only in Explore/Schedule (browsing mode). Never inside Marking Generator, Inventory, Feed Calc, Workers, Performance Tracker.

---

## APP STORE STRATEGY

### Framing (critical)
- App name: **"Sabong Farm Manager"** or **"Gamefowl Breeder OS"**
  — NOT "cockfighting app"
- Category: **Utilities** or **Agriculture**
- Description: Farm management, breeding records, derby scheduling tool
- Keywords: gamefowl, breeder, sabong, farm management, derby schedule
- Screenshots: Dashboard, Farm OS modules, Marking Generator, Schedule
  — NO fight videos, NO blood, NO animal injury content
- Content rating: 17+
- Include Report button on all public content — demonstrates active moderation

### Platform launch priority
1. **Android APK direct download first** — share via Facebook cockfighting groups, Viber, Messenger
2. **Google Play Store** — submit after APK proves the market (more lenient than Apple)
3. **PWA via Next.js** — iPhone users install to home screen from browser
4. **Apple App Store** — attempt last, or skip entirely (PH is 90%+ Android)

---

## MONETIZATION (Phase 9)

### Ads — AdMob first
- Banner ad — Explore screen bottom (browsing mode)
- Interstitial — after logging a fight result (natural task-complete pause)
- Interstitial — after confirming marking generation (natural task-complete pause)
- **ZERO ads inside Farm OS private modules** — tools must feel respectful
- Meta Audience Network — waterfall fallback after AdMob approved
- Direct sponsors at 10k+ users: feed brands (B-Meg, Purina), vet suppliers, gaff makers, derby organizers

### Farm Pro subscription
- `subscriptionTier: 'free' | 'pro'` on User model
- Free limits: 2 active seasons, 20 bird profiles, 50 fight records
- Farm Pro: unlimited + advanced analytics + export features + pedigree certificates
- Payment: **PayMongo** (GCash + credit card) primary for PH; Stripe secondary for international

### Revenue estimates (Philippines market)
| DAU | AdMob + Meta | Direct sponsors |
|---|---|---|
| 1,000 | ₱500–₱2,000/mo | too early |
| 10,000 | ₱5,000–₱20,000/mo | ₱5,000–₱20,000/mo |
| 50,000 | ₱25,000–₱100,000/mo | ₱20,000–₱80,000/mo |

---

## ENVIRONMENT VARIABLES

```bash
# API — apps/api/.env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/tiknok_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_me_32_chars_minimum
JWT_REFRESH_SECRET=change_me_different_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_ENDPOINT=https://sgp1.digitaloceanspaces.com
DO_SPACES_BUCKET=your-bucket-name
DO_SPACES_CDN_URL=https://your-bucket.sgp1.cdn.digitaloceanspaces.com
DO_SPACES_REGION=sgp1

AI_SERVICE_URL=http://localhost:8000
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Mobile — apps/mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.137.1:3001/api
EXPO_PUBLIC_WS_URL=ws://192.168.137.1:3001
EXPO_PUBLIC_WEB_URL=https://tiknok.com
```

---

## BUILD PHASES

### COMPLETED
- [x] Phase 0 — Architecture, tech stack, marking system design
- [x] Phase 1 — Monorepo, marking-engine, auth API, Breeder module API + mobile screens
- [x] Phase 2 — Instanok photos (complete but hidden — code preserved, tab removed)
- [x] Phase 3 — Video infrastructure (backend + worker done, mobile hidden, web-only)

---

### PHASE 4 — Home Dashboard ✅ COMPLETE
- [x] `GET /api/dashboard` — single endpoint, all user metrics, empty states
- [x] Home screen rebuilt as Farm Dashboard — Breeding, Inventory, Feed, Workers, Performance cards
- [x] Navigation: Home / Farm OS / (+) / Photos / Profile (interim — being updated to final 5-tab)

---

### PHASE 5 — Farm OS Modules

#### 5a — Farm Inventory ✅
- [x] FarmInventory model + API (GET + PUT)
- [x] Inventory screen — count inputs per category, save button, total birds

#### 5b — Feed Calculator ✅
- [x] FeedProgram model + API (GET + PUT + calculator)
- [x] Feed Calculator screen — grams, feedings/day, fasting, cost/kg, live output
- [ ] **FIX** — rename `fastingDayPerWeek: boolean` → `fastingDaysPerWeek: number (0-2)` in model + API + screen

#### 5c — Worker Manager ✅
- [x] Worker model + API (CRUD)
- [x] Workers screen — list, add/edit/deactivate/delete, monthly payroll total

#### 5d — Performance Tracker ✅
- [x] FightRecord model + API (CRUD + summary)
- [x] Performance screen — Summary tab + Records tab, log fight bottom sheet

#### 5e — Breeding Lifecycle
- [ ] Add lifecycle fields to BreedingSeason model (eggsLaid, expectedHatchDate, chicksHatched, hatchRate, maleCount, femaleCount, sexCountDone)
- [ ] `PATCH /api/seasons/:seasonId/lifecycle` route
- [ ] Season detail page — lifecycle progress bar after markings generated
  ```
  Markings ✓ → Eggs Laid → Hatch Day → Chick Count → Sex Count ✓
  ```
- [ ] "Update eggs laid" — input count, auto-sets expectedHatchDate (+21 days)
- [ ] "Update hatch count" — input chicksHatched, auto-calculates hatchRate
- [ ] "Record male/female count" — shown only after hatch count entered
- [ ] BullMQ delayed jobs — push notification reminders:
  - Day 7 after eggs laid: "Check your eggs — candling time"
  - Day 18 after eggs laid: "Lockdown in 3 days — stop turning eggs"
  - Day 21 after eggs laid: "Hatch day! Update your hatch count"
- [ ] Cancel all jobs once sexCountDone = true

#### 5f — Bird Profiles (THE KILLER FEATURE)
- [ ] Bird model (see Data Models above)
- [ ] `POST/GET/PATCH/DELETE /api/birds` routes
- [ ] Bird profile screen — photo, W/L/D stats bar, bloodline badge, marking code, lineage preview
- [ ] Add bird bottom sheet — link to mating, auto-fills marking from hen assignment
- [ ] Bird list in Farm OS hub — filter by status + bloodline
- [ ] Public bird card on breeder's Explore profile (isPublic birds only)

#### 5g — Bloodline / Lineage Tree
- [ ] Lineage tree screen per bird — visual tree: bird → parents → grandparents (min 3 generations)
- [ ] Each ancestor node is tappable — opens that bird's profile
- [ ] Inbreeding warning — red highlight if same bird appears on both sides of tree
- [ ] Shareable pedigree card — generates PNG: name, bloodline, 2-gen tree
  for sharing to Facebook / Messenger / Viber
- [ ] "Pedigree Certificate" style layout for the export card

---

### PHASE 6 — Derby Schedule
- [ ] DerbyEvent model + full CRUD API
- [ ] RSVP + bird entry registration API
- [ ] `POST /api/derbies/:id/results` — post results, auto-creates FightRecord per entry + updates Bird W/L counters
- [ ] Schedule screen — upcoming events list + calendar toggle
- [ ] Create event screen (any user can create — no organizer-only restriction)
- [ ] Event detail — venue, weight classes, entry list, RSVP button
- [ ] Register bird for derby — pick from My Birds, pick weight class
- [ ] Push notification reminders — 1 week before + 1 day before
- [ ] Results entry screen — per bird, tap to set win/loss/draw
- [ ] Upcoming derby widget on Home Dashboard card

---

### PHASE 7 — Explore Tab
- [ ] Replace current explore (Instanok photo feed) with breeder/bloodline discovery
- [ ] Explore API (see API Routes above)
- [ ] Search bar — searches breeders, farms, bloodlines simultaneously (Atlas Search)
- [ ] Featured breeders section — top win rates this month
- [ ] Bloodline directory — A-Z list, tap → see all public birds of that line
- [ ] Regional filter — Philippine province/region
- [ ] Breeder public profile page — farm name, location, public birds, W/L record, follow button

---

### PHASE 8 — Web App (Next.js) + Video
- [ ] Next.js app scaffold (App Router)
- [ ] Web token auto-login — `POST /api/auth/web-token` → browser session
- [ ] Full Tiknok video feed (web only — no App Store restrictions)
- [ ] HLS playback via DO Spaces CDN
- [ ] Video upload on web — same FFmpeg worker + BullMQ pipeline
- [ ] 1 min max free, 5 min paid (VIDEO_LIMITS config already exists)
- [ ] Shared design system (Tailwind — same color tokens as NativeWind)

---

### PHASE 9 — Monetization
- [ ] AdMob + Meta Audience Network integration
- [ ] `subscriptionTier` field on User model
- [ ] Free tier gates (2 seasons, 20 birds, 50 fights)
- [ ] "Upgrade to Pro" prompt component
- [ ] PayMongo integration (GCash + credit card)
- [ ] Stripe as secondary (international)

---

## DATABASE CLEANUP SCRIPT

Run once to clear all development test posts before going public.
Located at: `apps/api/scripts/clear-posts.ts`

```bash
cd apps/api && npx tsx scripts/clear-posts.ts
```

---

## DEV ENVIRONMENT

```
Terminal 1: cd apps/api && pnpm dev
Terminal 2: cd services/worker && pnpm dev
Terminal 3: cd apps/mobile && npx expo start --clear --lan

PC Hotspot IP: 192.168.137.1
Phone connects to PC hotspot WiFi
EXPO_PUBLIC_API_URL=http://192.168.137.1:3001/api
```

---

## HOW TO START A NEW CODING SESSION

```
"Read CLAUDE.md fully. Phases 0-5d are complete.
Current phase is [X]. Continue from the first unchecked task."
```

---

## LAST SESSION
Date: 2026-03-22
Completed:
- Phase 4 (Dashboard API + Home screen rebuild + nav interim structure)
- Phase 5a: Farm Inventory (model + API + screen)
- Phase 5b: Feed Calculator (model + API + screen)
- Phase 5c: Worker Manager (model + API + screen)
- Phase 5d: Performance Tracker (model + API + screen)
- CLAUDE.md: merged with strategic pivot document (final version)
Status: Phases 0-5d complete. Starting 5e (Breeding Lifecycle) next, then nav fix.
Next: Fix nav tabs → Home/Farm OS/Schedule/Explore/Profile, then Phase 5e.
