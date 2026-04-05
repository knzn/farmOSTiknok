import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { User } from '../models/user.js'
import { LoginEvent } from '../models/loginEvent.js'
import { Season } from '../models/season.js'
import { Mating } from '../models/mating.js'
import { Worker } from '../models/worker.js'
import { FarmExpense } from '../models/expense.js'
import type { JwtPayload } from '../plugins/auth.js'

export default async function adminRoutes(fastify: FastifyInstance) {

  // ── GET /api/admin/users ─────────────────────────────────────────────────
  // List all users with optional filter by status
  fastify.get('/users', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { status, search, page = '1', limit = '50' } = req.query as {
      status?: string
      search?: string
      page?: string
      limit?: string
    }

    const filter: Record<string, unknown> = {}

    if (status === 'banned') {
      filter.isBanned = true
    } else if (status && ['trial', 'active', 'expired', 'suspended'].includes(status)) {
      filter.subscriptionStatus = status
    }

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { tiknokId: { $regex: search, $options: 'i' } },
      ]
    }

    const pageNum  = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)))
    const skip     = (pageNum - 1) * limitNum

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -refreshToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ])

    return reply.send({
      users: users.map(formatUser),
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    })
  })

  // ── GET /api/admin/users/:id ─────────────────────────────────────────────
  fastify.get('/users/:id', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await User.findById(id).select('-passwordHash -refreshToken').lean()
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })
    return reply.send(formatUser(user))
  })

  // ── POST /api/admin/activate/:id ─────────────────────────────────────────
  // Activate subscription — body: { days: 30 | 365 }
  fastify.post('/activate/:id', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { days = 30 } = req.body as { days?: number }

    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })

    const now = new Date()
    // If already active, extend from current paidUntil; otherwise from today
    const base = (user.paidUntil && user.paidUntil > now) ? user.paidUntil : now
    const paidUntil = new Date(base)
    paidUntil.setDate(paidUntil.getDate() + days)

    user.subscriptionTier   = 'pro'
    user.subscriptionStatus = 'active'
    user.paidUntil          = paidUntil
    user.dataDeletesAt      = null  // clear any pending deletion
    await user.save()

    return reply.send({ success: true, paidUntil: paidUntil.toISOString() })
  })

  // ── POST /api/admin/extend/:id ───────────────────────────────────────────
  // Extend by X days (grace period, goodwill)
  fastify.post('/extend/:id', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { days = 7 } = req.body as { days?: number }

    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })

    const now  = new Date()
    const base = (user.paidUntil && user.paidUntil > now) ? user.paidUntil : now
    const paidUntil = new Date(base)
    paidUntil.setDate(paidUntil.getDate() + days)

    user.paidUntil          = paidUntil
    user.subscriptionStatus = 'active'
    user.dataDeletesAt      = null
    await user.save()

    return reply.send({ success: true, paidUntil: paidUntil.toISOString() })
  })

  // ── POST /api/admin/suspend/:id ──────────────────────────────────────────
  fastify.post('/suspend/:id', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })
    if (user.isAdmin) return reply.code(403).send({ error: 'Forbidden', message: 'Cannot suspend an admin' })

    user.subscriptionStatus = 'suspended'
    await user.save()

    return reply.send({ success: true })
  })

  // ── POST /api/admin/unsuspend/:id ────────────────────────────────────────
  fastify.post('/unsuspend/:id', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })

    const now = new Date()
    // Restore to correct status based on current dates
    if (user.paidUntil && user.paidUntil > now) {
      user.subscriptionStatus = 'active'
    } else if (user.trialEndsAt && user.trialEndsAt > now) {
      user.subscriptionStatus = 'trial'
    } else {
      user.subscriptionStatus = 'expired'
    }
    await user.save()

    return reply.send({ success: true, subscriptionStatus: user.subscriptionStatus })
  })

  // ── DELETE /api/admin/users/:id ──────────────────────────────────────────
  fastify.delete('/users/:id', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const adminId = (req.user as JwtPayload).sub

    if (id === adminId) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Cannot delete your own account' })
    }

    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })
    if (user.isAdmin) return reply.code(403).send({ error: 'Forbidden', message: 'Cannot delete an admin account' })

    await User.deleteOne({ _id: id })
    return reply.send({ success: true })
  })

  // ── POST /api/admin/users/:id/ban ───────────────────────────────────────
  fastify.post('/users/:id/ban', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const adminId = (req.user as JwtPayload).sub
    if (id === adminId) return reply.code(400).send({ error: 'Bad Request', message: 'Cannot ban yourself' })

    const { reason = '' } = req.body as { reason?: string }
    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })
    if (user.isAdmin) return reply.code(403).send({ error: 'Forbidden', message: 'Cannot ban an admin' })

    user.isBanned  = true
    user.banReason = reason.trim() || null
    user.bannedAt  = new Date()
    // Invalidate session
    user.refreshToken = null
    await user.save()

    return reply.send({ success: true })
  })

  // ── POST /api/admin/users/:id/unban ─────────────────────────────────────
  fastify.post('/users/:id/unban', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })

    user.isBanned  = false
    user.banReason = null
    user.bannedAt  = null
    await user.save()

    return reply.send({ success: true })
  })

  // ── PATCH /api/admin/users/:id/email ────────────────────────────────────
  fastify.patch('/users/:id/email', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { email } = req.body as { email?: string }

    if (!email || typeof email !== 'string') {
      return reply.code(400).send({ error: 'Bad Request', message: 'email is required' })
    }

    const normalised = email.trim().toLowerCase()
    const exists = await User.findOne({ email: normalised, _id: { $ne: id } }).lean()
    if (exists) return reply.code(409).send({ error: 'Conflict', message: 'Email already in use' })

    const user = await User.findByIdAndUpdate(id, { email: normalised }, { new: true }).lean()
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })

    return reply.send({ success: true, email: normalised })
  })

  // ── POST /api/admin/users/:id/password ──────────────────────────────────
  fastify.post('/users/:id/password', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { password } = req.body as { password?: string }

    if (!password || password.length < 8) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Password must be at least 8 characters' })
    }

    const user = await User.findById(id)
    if (!user) return reply.code(404).send({ error: 'Not Found', message: 'User not found' })

    user.passwordHash = await bcrypt.hash(password, 12)
    // Invalidate existing sessions when password is reset by admin
    user.refreshToken = null
    if (!user.authProviders.includes('local')) user.authProviders.push('local')
    await user.save()

    return reply.send({ success: true })
  })

  // ── GET /api/admin/users/:id/logins ─────────────────────────────────────
  fastify.get('/users/:id/logins', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { limit = '50' } = req.query as { limit?: string }
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)))

    const events = await LoginEvent.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean()

    return reply.send({
      events: events.map(e => ({
        _id:       e._id.toString(),
        ip:        e.ip,
        userAgent: e.userAgent,
        method:    e.method,
        success:   e.success,
        createdAt: e.createdAt.toISOString(),
      })),
    })
  })

  // ── GET /api/admin/users/:id/breeding ───────────────────────────────────
  fastify.get('/users/:id/breeding', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const [seasons, matings] = await Promise.all([
      Season.find({ userId: id }).sort({ year: -1, createdAt: -1 }).lean(),
      Mating.find({ userId: id }).select('seasonId maleName hens createdAt').lean(),
    ])

    // Group matings by seasonId for easy lookup
    const matingsBySeasonId: Record<string, number> = {}
    for (const m of matings) {
      const key = m.seasonId.toString()
      matingsBySeasonId[key] = (matingsBySeasonId[key] ?? 0) + 1
    }

    return reply.send({
      seasons: seasons.map(s => ({
        _id:              s._id.toString(),
        name:             s.name,
        year:             s.year,
        markingsGenerated: s.markingsGenerated,
        matingCount:      matingsBySeasonId[s._id.toString()] ?? 0,
        eggsLaid:         s.eggsLaid,
        chicksHatched:    s.chicksHatched,
        createdAt:        s.createdAt.toISOString(),
      })),
    })
  })

  // ── GET /api/admin/users/:id/finances ───────────────────────────────────
  fastify.get('/users/:id/finances', { preHandler: [fastify.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const now = new Date()

    const [workers, expenses] = await Promise.all([
      Worker.find({ userId: id }).select('name position monthlySalary advances payments createdAt').lean(),
      FarmExpense.find({ userId: id })
        .sort({ date: -1 })
        .limit(50)
        .lean(),
    ])

    // Compute total salary due across all workers (advances not yet paid)
    const totalSalaryDue = workers.reduce((sum, w) => sum + (w.monthlySalary ?? 0), 0)

    // Total expenses this month
    const thisMonth = now.getMonth() + 1
    const thisYear  = now.getFullYear()
    const expensesThisMonth = expenses
      .filter(e => e.month === thisMonth && e.year === thisYear)
      .reduce((sum, e) => sum + (e.totalAmount ?? e.amount ?? 0), 0)

    return reply.send({
      workers: workers.map(w => ({
        _id:           w._id.toString(),
        name:          w.name,
        position:      w.position,
        monthlySalary: w.monthlySalary,
        advanceCount:  w.advances?.length ?? 0,
        paymentCount:  w.payments?.length ?? 0,
        createdAt:     w.createdAt.toISOString(),
      })),
      recentExpenses: expenses.slice(0, 20).map(e => ({
        _id:         e._id.toString(),
        category:    e.category,
        name:        e.name ?? e.description,
        totalAmount: e.totalAmount ?? e.amount ?? 0,
        date:        e.date ? new Date(e.date as unknown as string).toISOString() : null,
        month:       e.month,
        year:        e.year,
      })),
      summary: {
        totalWorkers:      workers.length,
        totalSalaryDue,
        expensesThisMonth,
      },
    })
  })

  // ── GET /api/admin/stats ─────────────────────────────────────────────────
  fastify.get('/stats', { preHandler: [fastify.requireAdmin] }, async (_req, reply) => {
    const now   = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 7 days ago
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Trial ending within 7 days
    const trialEndingSoon = new Date(today)
    trialEndingSoon.setDate(trialEndingSoon.getDate() + 7)

    const [
      totalUsers,
      trialUsers,
      activeUsers,
      expiredUsers,
      suspendedUsers,
      newThisWeek,
      trialEndingThisWeek,
      newToday,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ subscriptionStatus: 'trial' }),
      User.countDocuments({ subscriptionStatus: 'active' }),
      User.countDocuments({ subscriptionStatus: 'expired' }),
      User.countDocuments({ subscriptionStatus: 'suspended' }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({
        subscriptionStatus: 'trial',
        trialEndsAt: { $gte: now, $lte: trialEndingSoon },
      }),
      User.countDocuments({ createdAt: { $gte: today } }),
    ])

    // New registrations per day — last 30 days
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year:  { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day:   { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ])

    return reply.send({
      users: {
        total: totalUsers,
        trial: trialUsers,
        active: activeUsers,
        expired: expiredUsers,
        suspended: suspendedUsers,
        newToday,
        newThisWeek,
        trialEndingThisWeek,
      },
      dailyRegistrations: dailyRegistrations.map((d) => ({
        date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
        count: d.count,
      })),
    })
  })
}

// ── helper ───────────────────────────────────────────────────────────────────

function formatUser(user: Record<string, unknown>) {
  return {
    _id:                (user._id as { toString(): string }).toString(),
    username:           user.username,
    email:              user.email,
    tiknokId:           user.tiknokId ?? null,
    isAdmin:            user.isAdmin ?? false,
    isBreeder:          user.isBreeder ?? false,
    isBanned:           user.isBanned ?? false,
    banReason:          user.banReason ?? null,
    bannedAt:           user.bannedAt ? new Date(user.bannedAt as string).toISOString() : null,
    subscriptionTier:   user.subscriptionTier ?? 'free',
    subscriptionStatus: user.subscriptionStatus ?? 'trial',
    trialEndsAt:        user.trialEndsAt ? new Date(user.trialEndsAt as string).toISOString() : null,
    paidUntil:          user.paidUntil   ? new Date(user.paidUntil as string).toISOString()   : null,
    dataDeletesAt:      user.dataDeletesAt ? new Date(user.dataDeletesAt as string).toISOString() : null,
    profilePhoto:       user.profilePhoto ?? null,
    authProviders:      user.authProviders ?? ['local'],
    createdAt:          user.createdAt ? new Date(user.createdAt as string).toISOString() : null,
  }
}
