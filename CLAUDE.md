# CLAUDE.md — TIKNOK App
> This file is the source of truth for every AI coding session.
> Read this ENTIRE file before writing a single line of code.
> Never deviate from decisions made here without explicit instruction from the owner.

---

## WHAT WE ARE BUILDING

**TIKNOK** — a **Breeding Management OS for Filipino gamefowl breeders.**

The one tool a serious breeder needs to manage their entire breeding operation — seasons, matings, markings, lifecycle tracking, and derby records. Private, fast, offline-capable.

**App name:** TIKNOK

---

## STRATEGIC DECISIONS (locked in)

### What this app IS
A breeding management tool. The private tool every serious breeder needs.

### What this app is NOT
- **NOT a video platform on mobile** — App Store/Play Store ban risk for cockfighting content
- **NOT competing with Facebook for photos** — Filipino breeders will never leave FB for photos
- **NOT a bird marketplace** — Facebook Marketplace already owns that in PH

### The moat (what no other platform has)
- **Marking Generator** — fully built, unique in the market
- **Breeding Lifecycle Tracking** — eggs, hatch rate, sex count per mating
- **Shareable Marking Cards** — PNG export to FB/Viber/Messenger
- **Derby Schedule** — event calendar, bird entry, results (planned)

### Photos (Instanok) — built but hidden
Phase 2 code stays in codebase. Hidden from tab bar. May be revisited post-launch.

### Videos (Tiknok) — web only, built later
Mobile tab hidden. Video infrastructure exists in backend + worker.
Video lives on the Web App (Phase 8). No App Store content restrictions there.

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
│   │   │   ├── SimpleBottomSheet.tsx
│   │   │   ├── MarkingExportCard.tsx
│   │   │   └── MarkingPicker.tsx
│   │   ├── hooks/            # Custom hooks
│   │   ├── stores/           # Zustand state stores
│   │   └── lib/              # API client (apiRequest, apiUpload), utils
│   ├── web/                  # Next.js 14 (App Router) — video lives here
│   └── api/                  # Node.js + Fastify
│       ├── src/
│       │   ├── routes/       # auth, seasons, posts, feed, users, dashboard
│       │   ├── plugins/      # auth, db, storage (DO Spaces), queue
│       │   ├── services/     # Business logic
│       │   └── lib/          # Shared utilities
│       └── Dockerfile
├── services/
│   ├── worker/               # BullMQ + FFmpeg HLS transcoding — DO NOT DELETE
│   └── ai/                   # Python FastAPI AI microservice
├── packages/
│   ├── types/                # Shared TypeScript types + Zod schemas
│   ├── marking-engine/       # Marking algorithm (pure TS, unit tested) — COMPLETE
│   └── ui/                   # Shared RN + web components (future)
├── docker-compose.yml
├── turbo.json
└── CLAUDE.md
```

---

## NAVIGATION STRUCTURE

```
Root Stack
├── (auth)/                    # Login, Register
└── (app)/                     # Protected routes
    ├── _layout.tsx            # Bottom Tab Bar (5 tabs)
    ├── index.tsx              # Home — Breeding Dashboard (breeding card only)
    ├── breeder/               # Farm OS hub
    │   ├── _layout.tsx
    │   ├── index.tsx          # Farm OS hub (Breeding Records + Farm Finance cards)
    │   ├── marking-generator/ # Breeding seasons + markings (BUILT)
    │   │   ├── index.tsx      # Season list — grouped by year, collapsible
    │   │   ├── generate/[seasonId].tsx   # Marking preview + confirm
    │   │   └── [seasonId]/
    │   │       ├── index.tsx  # Season detail — matings, lifecycle, export
    │   │       └── mating/
    │   │           ├── create.tsx
    │   │           └── edit.tsx
    │   └── finance/           # Farm Finance
    │       ├── index.tsx      # Finance hub (Workers card + Farm Expenses card)
    │       ├── workers/
    │       │   ├── index.tsx          # Worker list
    │       │   └── [workerId]/
    │       │       └── index.tsx      # Worker detail, advances, payslip export
    │       └── expenses/
    │           └── index.tsx          # Expense list — current month + history
    ├── schedule/              # Derby event calendar (planned)
    │   └── index.tsx
    ├── explore/               # Breeder/bloodline discovery (planned)
    │   └── index.tsx
    ├── profile/
    │   └── [userId].tsx
    └── notifications.tsx

    Hidden routes (code preserved, href: null):
    ├── create.tsx             # Photo post creation (hidden)
    └── tiknok.tsx             # Video feed (web-only)
```

### Bottom Tab Bar
```
[ Home ] [ Breeder ] [ Schedule ] [ Explore ] [ Profile ]
```
- Active tab: gold accent (#C8A84B)
- Tab bar: #0A0A0A background, #2A2A2A top border, 68px height

---

## UI / UX SYSTEM

### Theme
Dark mode is the primary design target. Both dark and light mode supported via NativeWind `dark:` variants.

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
- **FlashList** — all lists. Never FlatList.
- **Expo Image** — all images with blurhash placeholders
- **SimpleBottomSheet** — custom bottom sheet (no @gorhom — worklets issue in Expo Go)

### Sheets and Modals
- All bottom sheets use SimpleBottomSheet
- Drag handle at top, 12px border radius
- Never use Alert.alert for app UI — use custom sheet or modal (Alert.alert OK only for destructive confirm dialogs)
- Sheet snaps: 72% for forms, 90% for detail views, 45% for simple prompts

---

## DATA MODELS (current — only what exists in codebase)

### User
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
  farmName: string | null
  region: string | null           // Philippine province/region
  isBreeder: boolean
  subscriptionTier: 'free' | 'pro'
  followers: ObjectId[]
  following: ObjectId[]
  createdAt: Date
  updatedAt: Date
}
```

### Season
```typescript
{
  _id: ObjectId
  userId: ObjectId
  name: string
  year: number
  markingsGenerated: boolean
  generatedAt: Date | null
  // Lifecycle (tracked at season level — auto-summed from matings)
  eggsLaid: number | null
  expectedHatchDate: Date | null    // set when first mating records eggs
  chicksHatched: number | null
  hatchRate: number | null
  maleCount: number | null
  femaleCount: number | null
  sexCountDone: boolean
  sexCountUpdatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### Mating
```typescript
{
  _id: ObjectId
  seasonId: ObjectId
  userId: ObjectId
  maleName: string
  noseGroup: 'LN' | 'RN' | 'DN' | 'NONE' | 'OVERFLOW' | null
  sameMarking: boolean | null       // null when only 1 hen
  mandatoryMarking: string | null   // breeder-forced combo
  malePhoto: string | null          // DO Spaces URL
  hens: [{
    _id: ObjectId
    henName: string
    marking: string | null          // assigned combo e.g. 'LN-RI'
    previousMarking: string | null  // carried from duplicated season
    photo: string | null            // DO Spaces URL
    eggsLaid: number | null
    chicksHatched: number | null
    maleCount: number | null
    femaleCount: number | null
  }]
  // Lifecycle tracking — per-pen or per-hen
  useIndividualHenCount: boolean
  penEggsLaid: number | null
  penChicksHatched: number | null
  penMaleCount: number | null
  penFemaleCount: number | null
  // Computed totals (serialized, not stored)
  // totalEggsLaid, totalChicksHatched, totalMaleCount, totalFemaleCount
  createdAt: Date
  updatedAt: Date
}
```

### MarkingPool
```typescript
{
  _id: ObjectId
  seasonId: ObjectId
  userId: ObjectId
  assignments: [{
    matingId: ObjectId
    noseGroup: string
    combos: string[]
  }]
  usedCombos: string[]
  generatedAt: Date
}
```

### Worker
```typescript
{
  _id: ObjectId
  userId: ObjectId

  // Required
  name: string
  position: string              // preset or custom (see position list below)
  monthlySalary: number

  // Optional profile
  photo: string | null          // DO Spaces URL
  address: string | null
  phoneNumber: string | null
  fbLink: string | null

  // Advances (grouped by month/year)
  advances: [{
    _id: ObjectId
    amount: number
    reason: string | null       // optional — breeder may leave blank
    date: Date                  // actual date of advance request
    month: number               // 1–12
    year: number
    createdAt: Date
  }]

  // Payment records (created when owner marks month as Paid)
  payments: [{
    _id: ObjectId
    month: number
    year: number
    grossSalary: number
    totalAdvances: number
    netPay: number
    paidAt: Date
  }]

  createdAt: Date
  updatedAt: Date
}

// Position presets (stored as string — custom allowed)
// Farm Manager | Handler | Assistant Handler | Breeder | Assistant Breeder | Farm Buddy | <custom>
```

### FarmExpense
```typescript
{
  _id: ObjectId
  userId: ObjectId

  // Classification
  category: 'feeds' | 'vitamins' | 'medicines' | 'deworming' | 'workers_extra_budget' | 'miscellaneous'
  type: 'unit' | 'direct'          // drives form rendering — never infer from category name

  // Date — user sets this (purchase date, not entry date)
  date: Date
  month: number                    // 1–12, derived from date, stored for fast querying
  year: number                     // derived from date, stored for fast querying

  // type: 'unit' fields (feeds / vitamins / medicines / deworming)
  name: string | null              // product name
  unit: string | null              // 'Kilo' | 'Sacks' | 'Box' | 'Sachet' | '100mL' | '10mL' | 'Tablet/Capsule'
  quantity: number | null
  pricePerUnit: number | null      // ₱ per unit — client sends this
  totalAmount: number              // ALWAYS computed on backend: quantity × pricePerUnit
                                   // frontend total preview is UX only, never trusted

  // type: 'direct' fields (workers_extra_budget / miscellaneous)
  description: string | null       // miscellaneous only — what it was for
  amount: number | null            // workers_extra_budget defaults to 0

  // Shared optional fields
  receiptUrl: string | null        // DO Spaces URL — unit types only
                                   // upload enforced: max 1080px width, 75% quality (ImagePicker config)
  notes: string | null             // any category — "bulk buy", "split with another farm", etc.

  // Accounting integrity
  locked: boolean                  // default false — set true when month is closed (future feature)
  lockedAt: Date | null            // timestamp when month was finalized

  createdAt: Date
  updatedAt: Date
}

// Category → type mapping (locked, never change)
// feeds             → 'unit'
// vitamins          → 'unit'
// medicines         → 'unit'
// deworming         → 'unit'
// workers_extra_budget → 'direct'   NOTE: extra non-salary spending only (food allowance, bonuses)
//                                         NOT monthly salary or advances — those live in Worker model
// miscellaneous     → 'direct'

// MongoDB indexes (defined in schema)
// { userId: 1, year: 1, month: 1 }   ← primary query index
// { userId: 1, year: 1 }             ← history/summary queries
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
  duration: number | null
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed' | null
  visibility: 'public' | 'unlisted' | 'private'
  createdAt: Date
}
```

---

## API ROUTES (current — only what exists)

### Auth
```
POST  /api/auth/register
POST  /api/auth/login
POST  /api/auth/refresh
POST  /api/auth/logout
GET   /api/auth/me
POST  /api/auth/web-token        60s one-time token for web auto-login
GET   /api/auth/web-token/:token Web validates, returns session
```

### Dashboard
```
GET   /api/dashboard             Breeding metrics only (auth required)
```

### Breeding / Seasons
```
POST   /api/seasons
GET    /api/seasons
GET    /api/seasons/:seasonId
PATCH  /api/seasons/:seasonId
DELETE /api/seasons/:seasonId
POST   /api/seasons/:seasonId/duplicate          Copy season + carry previousMarking
POST   /api/seasons/:seasonId/matings
GET    /api/seasons/:seasonId/matings
GET    /api/seasons/:seasonId/matings/:matingId
PATCH  /api/seasons/:seasonId/matings/:matingId
DELETE /api/seasons/:seasonId/matings/:matingId
PATCH  /api/seasons/:seasonId/matings/:matingId/lifecycle   Egg/hatch/sex counts
POST   /api/seasons/:seasonId/matings/:matingId/photo       Upload male photo
DELETE /api/seasons/:seasonId/matings/:matingId/photo
POST   /api/seasons/:seasonId/matings/:matingId/hens/:henId/photo
DELETE /api/seasons/:seasonId/matings/:matingId/hens/:henId/photo
POST   /api/seasons/:seasonId/generate           Preview markings (no save)
POST   /api/seasons/:seasonId/generate/confirm   Save confirmed markings
POST   /api/seasons/:seasonId/generate/swap      Swap a single hen combo
DELETE /api/seasons/:seasonId/generate           Reset all markings
```

### Workers / Farm Finance
```
GET    /api/workers
POST   /api/workers
GET    /api/workers/:workerId
PATCH  /api/workers/:workerId
DELETE /api/workers/:workerId
POST   /api/workers/:workerId/photo           Upload worker photo
DELETE /api/workers/:workerId/photo           Remove worker photo
POST   /api/workers/:workerId/advances        Add advance request
DELETE /api/workers/:workerId/advances/:advanceId
POST   /api/workers/:workerId/pay             Mark month as paid (creates payment record)
```

### Farm Expenses
```
GET    /api/expenses                    ?month=&year= — entries for one month, sorted date: -1
GET    /api/expenses/summary            All months, totals only — powers history section (no entries)
GET    /api/expenses/:expenseId         Single entry
POST   /api/expenses                    Create — backend computes totalAmount = quantity × pricePerUnit
PATCH  /api/expenses/:expenseId         Edit — recomputes totalAmount, returns 403 if locked
DELETE /api/expenses/:expenseId         Delete — returns 403 if locked
POST   /api/expenses/:expenseId/receipt Upload receipt photo (multipart, DO Spaces)
DELETE /api/expenses/:expenseId/receipt Remove receipt photo
```

Summary endpoint response shape:
```typescript
{
  byMonth: [{
    month: number
    year: number
    total: number
    byCategory: {
      feeds: number
      vitamins: number
      medicines: number
      deworming: number
      workers_extra_budget: number
      miscellaneous: number
    }
  }]
}
```

### Posts / Photos (hidden on mobile, intact for web)
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

### Users / Social
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

## MARKING ENGINE (packages/marking-engine)

Pure TypeScript. No DB calls, no HTTP. Input in → output out. Unit tested.

**Rules:**
- Single-part marks (LN, RN, DN, LO, RO, LI, RI, DL, DR, OO, II) are **reserved** — never auto-assigned. Only used if breeder manually sets as mandatory, or when all 150 combinations are exhausted.
- Auto-assignment always prefers combination marks (e.g. LN-RI, RN-OO).
- Nose groups: LN, RN, DN. Each male gets one group. Max 3 matings per group (or OVERFLOW).
- `mandatoryMarking` on a mating locks that combo; algorithm works around it.
- After any source changes: run `pnpm build` in packages/marking-engine, then restart API.

---

## CODING RULES

1. **TypeScript everywhere.** No plain `.js` files. Strict mode on.
2. **Zod for all validation.** Every API input validated with Zod. Never use `any`.
3. **Never trust the client.** All `userId` filtering server-side. Always use `req.user._id` from JWT.
4. **marking-engine is pure.** No DB calls, no HTTP. Input in → output out.
5. **Conflict validation runs twice.** Client-side + server-side (400 error).
6. **Bottom sheets not pages.** Simple forms and confirmations = bottom sheets.
7. **Nothing from Breeding on the public feed.** Zero breeding data in public API.
8. **Video infrastructure stays.** Never delete video upload routes, worker, or FFmpeg code.
9. **Chunked uploads.** Large file uploads use multipart. Never buffer entire file in API memory.
10. **Monorepo imports.** Use `@app/types`, `@app/marking-engine` workspace aliases.
11. **NativeWind only for styling.** No StyleSheet.create. No inline style objects. Exception: Reanimated animated styles.
12. **FlashList not FlatList.** All lists use FlashList.
13. **Expo Router file-based navigation.** No React Navigation setup.
14. **Cursor-based pagination everywhere.** Never offset/page pagination.
15. **One dashboard API call.** Home screen loads all data in a single `GET /api/dashboard`.

---

## APP STORE STRATEGY

- App name: **"Sabong Farm Manager"** or **"Gamefowl Breeder OS"** — NOT "cockfighting app"
- Category: **Utilities** or **Agriculture**
- Keywords: gamefowl, breeder, sabong, farm management, derby schedule
- Content rating: 17+
- Screenshots: Dashboard, Breeding Records, Marking Generator, Schedule

### Platform launch priority
1. **Android APK direct download** — share via Facebook cockfighting groups, Viber, Messenger
2. **Google Play Store** — after APK proves the market
3. **PWA via Next.js** — iPhone users install to home screen from browser
4. **Apple App Store** — attempt last (PH is 90%+ Android)

---

## EAS BUILD SETUP (Android)

- EAS project: `tiknok` (owner: tiknok)
- Project ID: `9dd0a0c0-ee5e-4679-a449-96f124c9c245`
- Preview profile: Android APK (`buildType: apk`, `distribution: internal`)
- `EXPO_PUBLIC_API_URL` set as EAS env var for preview: `http://192.168.137.1:3001/api`
- `expo-build-properties` plugin: `android.usesCleartextTraffic: true` (HTTP for local dev)
- `expo-media-library` plugin registered in app.json
- Native modules (view-shot, media-library) require EAS build — not available in Expo Go
- JS-only changes work in Expo Go immediately

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

## CURRENT BUILD STATUS (as of 2026-03-25)

### COMPLETED

**Core infrastructure**
- [x] Monorepo setup (Turborepo, shared types, marking-engine)
- [x] Auth API (register, login, refresh, logout, JWT rotation)
- [x] Auth mobile screens (login, register)
- [x] DO Spaces storage plugin
- [x] BullMQ + Redis job queue
- [x] Photos infrastructure (hidden on mobile — code preserved)
- [x] Video infrastructure (backend + FFmpeg worker — web-only, DO NOT DELETE)

**Breeding Records — FULLY BUILT**
- [x] Season CRUD (create, edit, delete)
- [x] Season list grouped by year — current year expanded, past years collapsed
- [x] Duplicate season — copies matings + carries `previousMarking` per hen
- [x] Previous marking memory — banner + per-hen hint + "Keep previous" button
- [x] Mating CRUD (male + hens, same/diff marking, mandatory marking)
- [x] Marking Generator — auto-assign, preview, swap, confirm
- [x] Single-part marks reserved (LN, RN, DN, LO, RO, LI, RI, DL, DR, OO, II)
- [x] Marking export card — PNG saved to phone gallery (requires EAS build)
- [x] Export card customization — farm name, owner name, breeding totals toggle
- [x] Hatch date label — "Expected Hatch" (future) / "Hatch Date" (past)
- [x] Photo upload per male — camera icon in mating card + detail header
- [x] Photo upload per hen — camera icon per hen row in mating detail
- [x] Photo viewer modal — full-screen, tap to close
- [x] Breeding lifecycle per mating — eggs laid, chicks hatched, sex count
- [x] Lifecycle mode — pen total OR per-hen individual counts
- [x] Season-level lifecycle totals — auto-summed from matings
- [x] Expected hatch date — auto-set 21 days after first eggs recorded

**Dashboard**
- [x] `GET /api/dashboard` — breeding + finance data
- [x] Home screen — Breeding card + Finance card (workers count, salary due, advances)

**Farm Finance — Workers (BUILT)**
- [x] Worker CRUD (name, position presets + custom, monthly salary, salaryDay)
- [x] Salary period system — cycle based on salaryDay, not calendar month
- [x] Advance requests — amount, date, optional reason, grouped by period
- [x] Mark as Paid — creates payment record, locks advances for that period
- [x] Salary history — past periods collapsible, tap to expand
- [x] Pay day banner — warns when pay day reached and period unpaid
- [x] Worker photo upload (DO Spaces)
- [x] Payslip PNG export — farm name, owner name, salary cycle, advances breakdown
- [x] Payslip customization sheet — farm name + owner name saved to SecureStore

### REMOVED (intentionally deleted — do not rebuild without explicit instruction)
- ~~Farm Inventory~~ (model, routes, screen — deleted)
- ~~Feed Calculator~~ (model, routes, screen — deleted)
- ~~Worker Manager~~ (model, routes, screen — deleted)
- ~~Fight Performance~~ (model, routes, screen — deleted)
- ~~Bird Profiles~~ (model, routes, screen — deleted)

---

## NEXT FEATURES

### Farm Finance — Farm Expenses (NEXT — Step-by-step build plan below)

Entry: Finance hub (`breeder/finance/index.tsx`) — second card below Workers.

#### Build Order (strict — do not skip steps)

**Step 1 — CLAUDE.md** ✓ Done
**Step 2 — Data Model** `apps/api/src/models/expense.ts`
**Step 3 — API Routes** `apps/api/src/routes/expenses.ts` + register in index.ts
**Step 4 — Dashboard** Update `dashboard.ts` to include expense totals
**Step 5 — Finance Hub Card** Update `finance/index.tsx` — add Farm Expenses card
**Step 6 — Expenses List, Current Month** Create `finance/expenses/index.tsx` — month summary + grouped entries
**Step 7 — Add Expense Sheet** Category picker (Step 1) + dynamic form (Step 2) inside expenses/index.tsx
**Step 8 — Edit + Delete** Pre-filled edit sheet, Alert confirm delete, locked entry handling
**Step 9 — History Section** Summary fetch on load, collapsible years, one month open at a time
**Step 10 — Home Dashboard Card** Add expenses mini-card to `app/(app)/index.tsx`

#### Categories & Fields

| Category | type | Unit options | Has name | Has qty+price | Has receipt |
|---|---|---|---|---|---|
| Feeds | `unit` | Kilo · Sacks | ✓ | ✓ | optional |
| Vitamins | `unit` | Kilo · Box · Sachet · 100mL · 10mL · Tablet/Capsule | ✓ | ✓ | optional |
| Medicines | `unit` | Kilo · Box · Sachet · 100mL · 10mL · Tablet/Capsule | ✓ | ✓ | optional |
| Deworming | `unit` | Kilo · Box · Sachet · 100mL · 10mL · Tablet/Capsule | ✓ | ✓ | optional |
| Workers Extra Budget | `direct` | — | — | Amount only (default 0) | — |
| Miscellaneous | `direct` | — | description field | Amount only | — |

`workers_extra_budget` = extra non-salary labor spending only (food allowance, bonuses, pabaon). NOT monthly salary or advances — those live in the Worker model. Rename avoids double-counting.

Frontend renders form based on `type` field only — never `if (category === 'feeds')`.

#### Form Placeholders
- Feeds name: "e.g. Thunderbird, Salto"
- Vitamins name: "e.g. Bexan, B50, Respigen, Vitaminpro"
- Medicines name: "e.g. Abroxytyl, Doxylac, L-Spec"
- Deworming name: "e.g. Astig, Hammer, Strongguard"
- Miscellaneous description: "e.g. Transportation, Electricity, Mowing, Disinfection"

#### Input Rules
- Qty and Price: `keyboardType="numeric"` — strict numbers only
- Price = price per unit. Total = Qty × Price shown read-only (UX preview only)
- Backend always recomputes `totalAmount` — never trust client value
- Date defaults to today — user can change to actual purchase date
- Notes: optional single-line text field on all categories
- Receipt upload: max 1080px width, 75% quality enforced via ImagePicker config

#### Screen Layout — `finance/expenses/index.tsx`

**Current month** (always expanded at top):
- Month/year header
- Category summary chips (totals per category)
- "+ Add Expense" button — always visible, never disabled (multiple entries per category expected)
- Entries grouped by category, each row shows: name/description, unit+qty (if unit type), total ₱, date, receipt icon if set, notes icon if set
- Each row has inline Edit (✏) and Delete (🗑) buttons — always visible, no long press needed
- Locked entries show 🔒, edit/delete disabled
- Delete: Alert.alert confirm dialog only (no custom sheet)

**Add / Edit sheet** (snap: 90%):
- Edit skips Step 1 (category already known)
- Step 1: 2×3 category tile grid (🌾 Feeds · 💊 Vitamins · 🩺 Medicines · 🪱 Deworming · 👷 Workers Extra Budget · 📦 Miscellaneous)
- Step 2: dynamic form fields based on `type`
- Back button on Step 2 returns to Step 1

**History section** (below current month):
- Loaded from `GET /api/expenses/summary` on screen mount — lightweight, totals only
- Grouped by year, years collapsed by default
- State: `expandedYear: number | null` + `expandedMonth: string | null` (e.g. "2026-02")
- Only one month open at a time — opening a new one auto-closes previous
- Expanded month: same layout as current month but no "+ Add Expense" button
- Edit/Delete still available on past entries (for corrections)

#### API Rules for Expenses
- `totalAmount` always computed backend-side: `quantity * pricePerUnit`
- All queries: `.sort({ date: -1 })`
- `locked: true` → PATCH and DELETE return 403
- userId always from `req.user._id` — never from client

#### Dashboard Addition
```typescript
finance: {
  totalWorkers: number
  totalSalaryDue: number
  totalAdvancesThisMonth: number
  unpaidWorkers: number
  totalExpensesThisMonth: number          // sum of all expense totalAmount/amount this month
  expensesByCategory: {
    feeds: number
    vitamins: number
    medicines: number
    deworming: number
    workers_extra_budget: number
    miscellaneous: number
  }
}
```

---

## FUTURE PHASES (confirmed direction, details to be refined)

### Derby Schedule
- Derby event calendar — create, view, RSVP
- Bird entry registration per derby
- Results entry → auto-track win/loss per bird
- Push notification reminders (1 week + 1 day before)
- Upcoming derby widget on Home Dashboard

### Explore Tab
- Replace current placeholder with breeder/bloodline discovery
- Search breeders, farms, bloodlines (Atlas Search)
- Featured breeders — top win rates this season
- Bloodline directory A-Z
- Regional filter (Philippine province)
- Public breeder profile — farm name, location, W/L record

### Web App + Video (Phase 8 — build last)
- Next.js app (App Router)
- Web token auto-login handoff from mobile
- Full video feed (no App Store restrictions on web)
- HLS playback via DO Spaces CDN
- Video upload — same FFmpeg worker + BullMQ pipeline

---

## HOW TO START A NEW CODING SESSION

```
"Read CLAUDE.md fully. Current status is in the CURRENT BUILD STATUS section.
New features to build are in the NEXT FEATURES section."
```
