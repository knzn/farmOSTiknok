import type { FastifyInstance } from 'fastify'
import { Season } from '../models/season.js'
import { Mating } from '../models/mating.js'
import { Worker } from '../models/worker.js'
import { FarmExpense } from '../models/expense.js'
import type { JwtPayload } from '../plugins/auth.js'

function userId(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

export default async function dashboardRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/dashboard
   * Returns breeding + finance metrics in one call.
   * Auth required. All data filtered by userId.
   */
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const [seasons, matings, workers, expensesThisMonth] = await Promise.all([
      Season.find({ userId: uid }).sort({ createdAt: -1 }).lean(),
      Mating.find({ userId: uid }).lean(),
      Worker.find({ userId: uid }).lean(),
      FarmExpense.find({ userId: uid, month: currentMonth, year: currentYear }).lean(),
    ])

    // ── Breeding ─────────────────────────────────────────────────────────────
    const activeSeason = seasons[0] ?? null
    const activeSeasonMatings = activeSeason
      ? matings.filter((m) => m.seasonId.toString() === activeSeason._id.toString())
      : []

    const breeding = {
      totalSeasons: seasons.length,
      activeSeason: activeSeason
        ? {
            id: activeSeason._id,
            name: activeSeason.name,
            year: activeSeason.year,
            markingsGenerated: activeSeason.markingsGenerated,
            matingCount: activeSeasonMatings.length,
            eggsLaid: activeSeason.eggsLaid ?? null,
            chicksHatched: activeSeason.chicksHatched ?? null,
            hatchRate: activeSeason.hatchRate ?? null,
            sexCountDone: activeSeason.sexCountDone ?? false,
          }
        : null,
      totalMatings: matings.length,
    }

    // ── Finance ───────────────────────────────────────────────────────────────
    const totalSalaryDue = workers.reduce((sum, w) => sum + w.monthlySalary, 0)

    const totalAdvancesThisMonth = workers.reduce((sum, w) => {
      const monthAdvances = w.advances
        .filter((a) => a.month === currentMonth && a.year === currentYear)
        .reduce((s, a) => s + a.amount, 0)
      return sum + monthAdvances
    }, 0)

    // Count workers whose current month is NOT yet paid
    const unpaidWorkers = workers.filter(
      (w) => !w.payments.some((p) => p.month === currentMonth && p.year === currentYear),
    ).length

    // ── Expenses ──────────────────────────────────────────────────────────────
    const expensesByCategory = {
      feeds:                0,
      vitamins:             0,
      medicines:            0,
      deworming:            0,
      workers_extra_budget: 0,
      miscellaneous:        0,
    } as Record<string, number>

    let totalExpensesThisMonth = 0
    for (const e of expensesThisMonth) {
      const amount = e.totalAmount ?? 0
      totalExpensesThisMonth += amount
      if (e.category in expensesByCategory) {
        expensesByCategory[e.category] += amount
      }
    }

    const finance = {
      totalWorkers: workers.length,
      totalSalaryDue,
      totalAdvancesThisMonth,
      unpaidWorkers,
      totalExpensesThisMonth,
      expensesByCategory,
    }

    return reply.send({ breeding, finance })
  })
}
