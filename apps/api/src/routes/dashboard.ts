import type { FastifyInstance } from 'fastify'
import { Season } from '../models/season.js'
import { Mating } from '../models/mating.js'
import { FarmInventory } from '../models/farmInventory.js'
import { FeedProgram } from '../models/feedProgram.js'
import { Worker } from '../models/worker.js'
import { FightRecord } from '../models/fightRecord.js'

function userId(req: any): string {
  return req.user._id.toString()
}

export default async function dashboardRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/dashboard
   * Returns all farm metrics in one call.
   * Auth required. All data filtered by userId.
   */
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const uid = userId(req)

    // Run all queries in parallel for speed
    const [seasons, matings, inventoryDoc, feedProgramDoc, activeWorkers, fightRecords] = await Promise.all([
      Season.find({ userId: uid }).sort({ createdAt: -1 }).lean(),
      Mating.find({ userId: uid }).lean(),
      FarmInventory.findOne({ userId: uid }).lean(),
      FeedProgram.findOne({ userId: uid }).lean(),
      Worker.find({ userId: uid, isActive: true }).lean(),
      FightRecord.find({ userId: uid }).lean(),
    ])

    // ── Breeding summary ─────────────────────────────────────────────────────
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

    // ── Inventory ─────────────────────────────────────────────────────────────
    const inv = inventoryDoc
    const stags = inv?.stags ?? 0
    const pullets = inv?.pullets ?? 0
    const broodHens = inv?.broodHens ?? 0
    const chicks = inv?.chicks ?? 0
    const cocks = inv?.cocks ?? 0
    const total = stags + pullets + broodHens + chicks + cocks
    const inventory = {
      stags,
      pullets,
      broodHens,
      chicks,
      cocks,
      total,
      hasData: !!inv && total > 0,
    }

    // ── Feed budget ───────────────────────────────────────────────────────────
    let feedBudget = { dailyKg: 0, weeklyKg: 0, monthlyKg: 0, monthlyCost: 0, currency: 'PHP', hasData: false }
    if (feedProgramDoc) {
      const birds = total // use inventory total
      const dailyGrams = birds * feedProgramDoc.gramsPerFeeding * feedProgramDoc.feedingsPerDay
      const dailyKg = dailyGrams / 1000
      const weeklyKg = dailyKg * (7 - (feedProgramDoc.fastingDaysPerWeek ?? 0))
      const monthlyKg = weeklyKg * 4.33
      const monthlyCost = monthlyKg * feedProgramDoc.costPerKg
      feedBudget = {
        dailyKg: Math.round(dailyKg * 100) / 100,
        weeklyKg: Math.round(weeklyKg * 100) / 100,
        monthlyKg: Math.round(monthlyKg * 100) / 100,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        currency: feedProgramDoc.currency,
        hasData: true,
      }
    }

    // ── Workers ───────────────────────────────────────────────────────────────
    const monthlyTotal = activeWorkers.reduce((sum, w) => {
      return sum + (w.payType === 'daily' ? w.payAmount * 26 : w.payAmount)
    }, 0)
    const workers = {
      count: activeWorkers.length,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      currency: 'PHP',
      hasData: activeWorkers.length > 0,
    }

    // ── Performance ───────────────────────────────────────────────────────────
    const wins = fightRecords.filter(r => r.result === 'win').length
    const losses = fightRecords.filter(r => r.result === 'loss').length
    const draws = fightRecords.filter(r => r.result === 'draw').length
    const decided = wins + losses
    const winRate = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0
    const stagWins: Record<string, number> = {}
    for (const r of fightRecords) {
      if (r.result === 'win') stagWins[r.stagName] = (stagWins[r.stagName] ?? 0) + 1
    }
    const bestStag = Object.keys(stagWins).reduce<string | null>(
      (best, name) => (best === null || stagWins[name]! > stagWins[best]!) ? name : best,
      null,
    )
    const performance = {
      wins, losses, draws, winRate, bestStag,
      hasData: fightRecords.length > 0,
    }

    return reply.send({
      breeding,
      inventory,
      feedBudget,
      workers,
      performance,
    })
  })
}
