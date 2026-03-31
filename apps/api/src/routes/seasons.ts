import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { Season, type ISeason } from '../models/season.js'
import { Mating, type IMating } from '../models/mating.js'
import { MarkingPool } from '../models/markingPool.js'
import type { JwtPayload } from '../plugins/auth.js'
import {
  CreateSeasonInputSchema,
  CreateMatingInputSchema,
  GenerateConfirmInputSchema,
} from '@app/types'
import {
  generateMarkings,
  isValidCombo,
  getAllValidCombos,
} from '@app/marking-engine'

// ─── helpers ────────────────────────────────────────────────────────────────

function userId(req: { user: unknown }): string {
  return (req.user as JwtPayload).sub
}

function notFound(reply: FastifyReply, msg = 'Not found') {
  return reply.code(404).send({ error: 'Not Found', message: msg, statusCode: 404 })
}

// Verify the season belongs to this user; throws 404 if not
async function requireSeason(seasonId: string, uid: string) {
  const season = await Season.findOne({ _id: seasonId, userId: uid })
  if (!season) return null
  return season
}

// ─── season routes ───────────────────────────────────────────────────────────

export default async function seasonRoutes(fastify: FastifyInstance) {
  // All routes require auth
  fastify.addHook('preHandler', fastify.authenticate)

  // Write routes require active subscription
  fastify.addHook('preHandler', async (req, reply) => {
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      await fastify.requireSubscription(req, reply)
    }
  })

  // ── POST /api/seasons ─────────────────────────────────────────
  fastify.post('/', async (req, reply) => {
    const input = CreateSeasonInputSchema.parse(req.body)
    const season = await Season.create({ ...input, userId: userId(req) })
    return reply.code(201).send(serializeSeason(season))
  })

  // ── GET /api/seasons ──────────────────────────────────────────
  fastify.get('/', async (req) => {
    const uid = userId(req)
    const seasons = await Season.find({ userId: uid }).sort({ createdAt: -1 })

    // Count matings per season in one query
    const matingDocs = await Mating.find({ userId: uid }, { seasonId: 1 }).lean()
    const countMap = new Map<string, number>()
    for (const m of matingDocs) {
      const key = m.seasonId.toString()
      countMap.set(key, (countMap.get(key) ?? 0) + 1)
    }

    return seasons.map((s) => ({
      ...serializeSeason(s),
      matingCount: countMap.get(s._id.toString()) ?? 0,
    }))
  })

  // ── GET /api/seasons/:seasonId ────────────────────────────────
  fastify.get<{ Params: { seasonId: string } }>('/:seasonId', async (req, reply) => {
    const season = await requireSeason(req.params.seasonId, userId(req))
    if (!season) return notFound(reply, 'Season not found')
    return serializeSeason(season)
  })

  // ── PATCH /api/seasons/:seasonId ──────────────────────────────
  fastify.patch<{ Params: { seasonId: string } }>('/:seasonId', async (req, reply) => {
    const input = z
      .object({ name: z.string().min(1).max(100).optional(), year: z.number().int().min(2000).max(2100).optional() })
      .parse(req.body)

    const season = await Season.findOneAndUpdate(
      { _id: req.params.seasonId, userId: userId(req) },
      { $set: input },
      { new: true },
    )
    if (!season) return notFound(reply, 'Season not found')
    return serializeSeason(season)
  })

  // ── PATCH /api/seasons/:seasonId/lifecycle ────────────────────
  fastify.patch<{ Params: { seasonId: string } }>('/:seasonId/lifecycle', async (req, reply) => {
    const uid = userId(req)
    const body = z.object({
      eggsLaid: z.number().int().min(0).nullable().optional(),
      expectedHatchDate: z.string().datetime().nullable().optional(),
      chicksHatched: z.number().int().min(0).nullable().optional(),
      maleCount: z.number().int().min(0).nullable().optional(),
      femaleCount: z.number().int().min(0).nullable().optional(),
      sexCountDone: z.boolean().optional(),
    }).parse(req.body)

    const update: Record<string, unknown> = { ...body }

    // Auto-calculate hatch rate when both values are present
    if (body.chicksHatched !== undefined || body.eggsLaid !== undefined) {
      const season = await Season.findOne({ _id: req.params.seasonId, userId: uid }).lean()
      if (season) {
        const laid = body.eggsLaid !== undefined ? body.eggsLaid : season.eggsLaid
        const hatched = body.chicksHatched !== undefined ? body.chicksHatched : season.chicksHatched
        if (laid && hatched !== null && hatched !== undefined) {
          update.hatchRate = Math.round((hatched / laid) * 1000) / 10
        }
      }
    }

    if (body.sexCountDone) {
      update.sexCountUpdatedAt = new Date()
    }

    const season = await Season.findOneAndUpdate(
      { _id: req.params.seasonId, userId: uid },
      { $set: update },
      { new: true },
    )
    if (!season) return notFound(reply, 'Season not found')
    return reply.send(serializeSeason(season))
  })

  // ── DELETE /api/seasons/:seasonId ─────────────────────────────
  fastify.delete<{ Params: { seasonId: string } }>('/:seasonId', async (req, reply) => {
    const uid = userId(req)
    const season = await Season.findOneAndDelete({ _id: req.params.seasonId, userId: uid })
    if (!season) return notFound(reply, 'Season not found')

    // Cascade: delete matings + marking pool
    await Promise.all([
      Mating.deleteMany({ seasonId: season._id, userId: uid }),
      MarkingPool.deleteOne({ seasonId: season._id, userId: uid }),
    ])
    return reply.send({ message: 'Season deleted' })
  })

  // ─── mating sub-routes ────────────────────────────────────────────────────

  // ── POST /api/seasons/:seasonId/matings ───────────────────────
  fastify.post<{ Params: { seasonId: string } }>('/:seasonId/matings', async (req, reply) => {
    const uid = userId(req)
    const season = await requireSeason(req.params.seasonId, uid)
    if (!season) return notFound(reply, 'Season not found')

    const input = CreateMatingInputSchema.parse(req.body)

    // Validate henNames count matches henCount
    if (input.henNames.length !== input.henCount) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `henNames must have exactly ${input.henCount} entries`,
        statusCode: 400,
      })
    }

    // sameMarking must be null when henCount === 1
    const sameMarking = input.henCount === 1 ? null : input.sameMarking

    // Validate mandatory marking if provided
    if (input.mandatoryMarking && !isValidCombo(input.mandatoryMarking)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `"${input.mandatoryMarking}" is not a valid marking combination`,
        statusCode: 400,
      })
    }

    const mating = await Mating.create({
      seasonId: season._id,
      userId: uid,
      maleName: input.maleName,
      henCount: input.henCount,
      sameMarking,
      mandatoryMarking: input.mandatoryMarking ?? null,
      hens: input.henNames.map((name) => ({ henName: name, marking: null })),
    })

    return reply.code(201).send(serializeMating(mating))
  })

  // ── GET /api/seasons/:seasonId/matings ────────────────────────
  fastify.get<{ Params: { seasonId: string } }>('/:seasonId/matings', async (req, reply) => {
    const uid = userId(req)
    const season = await requireSeason(req.params.seasonId, uid)
    if (!season) return notFound(reply, 'Season not found')

    const matings = await Mating.find({ seasonId: season._id, userId: uid }).sort({ createdAt: 1 })
    return matings.map(serializeMating)
  })

  // ── GET /api/seasons/:seasonId/matings/:matingId ──────────────
  fastify.get<{ Params: { seasonId: string; matingId: string } }>(
    '/:seasonId/matings/:matingId',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const mating = await Mating.findOne({
        _id: req.params.matingId,
        seasonId: season._id,
        userId: uid,
      })
      if (!mating) return notFound(reply, 'Mating not found')
      return serializeMating(mating)
    },
  )

  // ── PATCH /api/seasons/:seasonId/matings/:matingId ────────────
  fastify.patch<{ Params: { seasonId: string; matingId: string } }>(
    '/:seasonId/matings/:matingId',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const input = z
        .object({
          maleName: z.string().min(1).max(100).optional(),
          mandatoryMarking: z.string().nullable().optional(),
          sameMarking: z.boolean().nullable().optional(),
          henNames: z.array(z.string().min(1).max(100)).min(1).optional(),
        })
        .parse(req.body)

      // Validate mandatory marking if provided
      if (input.mandatoryMarking && !isValidCombo(input.mandatoryMarking)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `"${input.mandatoryMarking}" is not a valid marking combination`,
          statusCode: 400,
        })
      }

      const updateFields: Record<string, unknown> = {}
      if (input.maleName !== undefined) updateFields.maleName = input.maleName
      if (input.mandatoryMarking !== undefined) updateFields.mandatoryMarking = input.mandatoryMarking
      if (input.sameMarking !== undefined) updateFields.sameMarking = input.sameMarking

      if (input.henNames) {
        const existing = await Mating.findOne({ _id: req.params.matingId, seasonId: season._id, userId: uid })
        if (!existing) return notFound(reply, 'Mating not found')

        // Rebuild hens array — preserve existing hen data by position, append or trim
        const newHens = input.henNames.map((name, idx) => {
          const old = existing.hens[idx]
          return old ? { ...old.toObject(), henName: name } : { henName: name }
        })
        updateFields.hens = newHens
      }

      const mating = await Mating.findOneAndUpdate(
        { _id: req.params.matingId, seasonId: season._id, userId: uid },
        { $set: updateFields },
        { new: true },
      )
      if (!mating) return notFound(reply, 'Mating not found')
      return serializeMating(mating)
    },
  )

  // ── PATCH /api/seasons/:seasonId/matings/:matingId/lifecycle ──
  // Update egg/hatch/sex counts for a single mating (pen or per-hen)
  fastify.patch<{ Params: { seasonId: string; matingId: string } }>(
    '/:seasonId/matings/:matingId/lifecycle',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const body = z.object({
        useIndividualHenCount: z.boolean().optional(),
        // Pen-total fields (used when useIndividualHenCount = false)
        penEggsLaid: z.number().int().min(0).nullable().optional(),
        penChicksHatched: z.number().int().min(0).nullable().optional(),
        penMaleCount: z.number().int().min(0).nullable().optional(),
        penFemaleCount: z.number().int().min(0).nullable().optional(),
        // Per-hen fields (used when useIndividualHenCount = true)
        hens: z.array(z.object({
          henId: z.string(),
          eggsLaid: z.number().int().min(0).nullable().optional(),
          chicksHatched: z.number().int().min(0).nullable().optional(),
          maleCount: z.number().int().min(0).nullable().optional(),
          femaleCount: z.number().int().min(0).nullable().optional(),
        })).optional(),
      }).parse(req.body)

      const mating = await Mating.findOne({
        _id: req.params.matingId,
        seasonId: season._id,
        userId: uid,
      })
      if (!mating) return notFound(reply, 'Mating not found')

      // ── Validation helpers ────────────────────────────────────
      function badRequest(message: string) {
        return reply.code(400).send({ error: 'Bad Request', message, statusCode: 400 })
      }

      const useIndividual = body.useIndividualHenCount !== undefined
        ? body.useIndividualHenCount
        : (mating.useIndividualHenCount ?? false)

      if (!useIndividual) {
        // Pen-total validation — merge incoming with existing values
        const eggs    = body.penEggsLaid      !== undefined ? body.penEggsLaid      : (mating.penEggsLaid ?? null)
        const hatched = body.penChicksHatched !== undefined ? body.penChicksHatched : (mating.penChicksHatched ?? null)
        const males   = body.penMaleCount     !== undefined ? body.penMaleCount     : (mating.penMaleCount ?? null)
        const females = body.penFemaleCount   !== undefined ? body.penFemaleCount   : (mating.penFemaleCount ?? null)

        if (eggs !== null && hatched !== null && hatched > eggs) {
          return badRequest(`Chicks hatched (${hatched}) cannot exceed eggs laid (${eggs})`)
        }
        if (hatched !== null && males !== null && females !== null && (males + females) > hatched) {
          return badRequest(`Males + females (${males + females}) cannot exceed chicks hatched (${hatched})`)
        }
        if (hatched !== null && males !== null && females === null && males > hatched) {
          return badRequest(`Males (${males}) cannot exceed chicks hatched (${hatched})`)
        }
        if (hatched !== null && females !== null && males === null && females > hatched) {
          return badRequest(`Females (${females}) cannot exceed chicks hatched (${hatched})`)
        }
      } else if (body.hens && body.hens.length > 0) {
        // Per-hen validation — validate each hen against merged values
        for (const henUpdate of body.hens) {
          const existingHen = mating.hens.find((h) => h._id.toString() === henUpdate.henId)
          if (!existingHen) continue

          const eggs    = henUpdate.eggsLaid      !== undefined ? henUpdate.eggsLaid      : (existingHen.eggsLaid ?? null)
          const hatched = henUpdate.chicksHatched !== undefined ? henUpdate.chicksHatched : (existingHen.chicksHatched ?? null)
          const males   = henUpdate.maleCount     !== undefined ? henUpdate.maleCount     : (existingHen.maleCount ?? null)
          const females = henUpdate.femaleCount   !== undefined ? henUpdate.femaleCount   : (existingHen.femaleCount ?? null)
          const name    = existingHen.henName

          if (eggs !== null && hatched !== null && hatched > eggs) {
            return badRequest(`${name}: chicks hatched (${hatched}) cannot exceed eggs laid (${eggs})`)
          }
          if (hatched !== null && males !== null && females !== null && (males + females) > hatched) {
            return badRequest(`${name}: males + females (${males + females}) cannot exceed chicks hatched (${hatched})`)
          }
          if (hatched !== null && males !== null && females === null && males > hatched) {
            return badRequest(`${name}: males (${males}) cannot exceed chicks hatched (${hatched})`)
          }
          if (hatched !== null && females !== null && males === null && females > hatched) {
            return badRequest(`${name}: females (${females}) cannot exceed chicks hatched (${hatched})`)
          }
        }
      }

      // ── Build update fields ───────────────────────────────────
      const updateFields: Record<string, unknown> = {}

      if (body.useIndividualHenCount !== undefined) {
        updateFields.useIndividualHenCount = body.useIndividualHenCount
      }
      if (body.penEggsLaid !== undefined) updateFields.penEggsLaid = body.penEggsLaid
      if (body.penChicksHatched !== undefined) updateFields.penChicksHatched = body.penChicksHatched
      if (body.penMaleCount !== undefined) updateFields.penMaleCount = body.penMaleCount
      if (body.penFemaleCount !== undefined) updateFields.penFemaleCount = body.penFemaleCount

      // Per-hen updates — match by henId
      if (body.hens && body.hens.length > 0) {
        for (const henUpdate of body.hens) {
          const idx = mating.hens.findIndex((h) => h._id.toString() === henUpdate.henId)
          if (idx === -1) continue
          if (henUpdate.eggsLaid !== undefined) updateFields[`hens.${idx}.eggsLaid`] = henUpdate.eggsLaid
          if (henUpdate.chicksHatched !== undefined) updateFields[`hens.${idx}.chicksHatched`] = henUpdate.chicksHatched
          if (henUpdate.maleCount !== undefined) updateFields[`hens.${idx}.maleCount`] = henUpdate.maleCount
          if (henUpdate.femaleCount !== undefined) updateFields[`hens.${idx}.femaleCount`] = henUpdate.femaleCount
        }
      }

      const updated = await Mating.findOneAndUpdate(
        { _id: req.params.matingId, seasonId: season._id, userId: uid },
        { $set: updateFields },
        { new: true },
      )
      if (!updated) return notFound(reply, 'Mating not found')

      // Auto-set season expectedHatchDate the first time any eggs are recorded
      const eggsBeingSet =
        (body.penEggsLaid != null && body.penEggsLaid > 0) ||
        body.hens?.some((h: { eggsLaid?: number | null }) => h.eggsLaid != null && h.eggsLaid > 0)
      if (eggsBeingSet && !season.expectedHatchDate) {
        const hatch = new Date()
        hatch.setDate(hatch.getDate() + 21)
        await Season.updateOne({ _id: season._id, userId: uid }, { $set: { expectedHatchDate: hatch } })
      }

      return reply.send(serializeMating(updated))
    },
  )

  // ── DELETE /api/seasons/:seasonId/matings/:matingId ───────────
  fastify.delete<{ Params: { seasonId: string; matingId: string } }>(
    '/:seasonId/matings/:matingId',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const mating = await Mating.findOneAndDelete({
        _id: req.params.matingId,
        seasonId: season._id,
        userId: uid,
      })
      if (!mating) return notFound(reply, 'Mating not found')
      return reply.send({ message: 'Mating deleted' })
    },
  )

  // ─── generate sub-routes ──────────────────────────────────────────────────

  // ── POST /api/seasons/:seasonId/generate ──────────────────────
  // Run the marking algorithm — returns preview, does NOT save
  fastify.post<{ Params: { seasonId: string } }>('/:seasonId/generate', async (req, reply) => {
    const uid = userId(req)
    const season = await requireSeason(req.params.seasonId, uid)
    if (!season) return notFound(reply, 'Season not found')

    const matings = await Mating.find({ seasonId: season._id, userId: uid }).sort({ createdAt: 1 })
    if (matings.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Add at least one mating before generating markings',
        statusCode: 400,
      })
    }

    // Build MatingInput[] for the algorithm
    const matingInputs = matings.map((m) => ({
      id: m._id.toString(),
      maleName: m.maleName,
      henCount: m.hens.length,
      henNames: m.hens.map((h) => h.henName),
      sameMarking: m.sameMarking,
      mandatoryMarking: m.mandatoryMarking,
    }))

    // Optional per-mating overrides from request body
    const { overrides = [] } = (req.body as { overrides?: Array<{ matingId: string; marking: string }> }) ?? {}

    let result
    try {
      result = generateMarkings(matingInputs, overrides)
    } catch (err) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: err instanceof Error ? err.message : 'Marking generation failed',
        statusCode: 400,
      })
    }

    // Return preview — not saved yet
    return reply.send({
      preview: result.map((a) => ({
        matingId: a.matingId,
        maleName: a.maleName,
        noseGroup: a.noseGroup,
        hens: a.hens,
      })),
    })
  })

  // ── POST /api/seasons/:seasonId/generate/confirm ──────────────
  // Save the confirmed assignment to DB
  fastify.post<{ Params: { seasonId: string } }>(
    '/:seasonId/generate/confirm',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const input = GenerateConfirmInputSchema.parse(req.body)

      // Validate all markings are valid combos
      for (const assignment of input.assignments) {
        for (const hen of assignment.hens) {
          if (!isValidCombo(hen.marking)) {
            return reply.code(400).send({
              error: 'Bad Request',
              message: `"${hen.marking}" is not a valid marking combination`,
              statusCode: 400,
            })
          }
        }
      }

      // Ensure no duplicate combos within this season (same-marking is OK to repeat within a mating)
      // Build per-mating groups first to check duplicates across different matings
      const allCombos: string[] = []
      for (const assignment of input.assignments) {
        const mating = await Mating.findOne({
          _id: assignment.matingId,
          seasonId: season._id,
          userId: uid,
        })
        if (!mating) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: `Mating ${assignment.matingId} not found`,
            statusCode: 400,
          })
        }

        // For same-marking matings all hens share one combo — only count it once
        const uniqueInMating = [...new Set(assignment.hens.map((h) => h.marking))]
        allCombos.push(...uniqueInMating)
      }

      const uniqueCombos = new Set(allCombos)
      if (uniqueCombos.size !== allCombos.length) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Duplicate markings detected across matings',
          statusCode: 400,
        })
      }

      // Write to DB inside a transaction-like sequence
      // Update each mating with its assigned hen markings + noseGroup
      await Promise.all(
        input.assignments.map(async (assignment) => {
          const henUpdates: Record<string, string> = {}
          assignment.hens.forEach((h, idx) => {
            henUpdates[`hens.${idx}.marking`] = h.marking
          })
          return Mating.updateOne(
            { _id: assignment.matingId, seasonId: season._id, userId: uid },
            { $set: { noseGroup: assignment.noseGroup, ...henUpdates } },
          )
        }),
      )

      // Upsert marking pool record
      await MarkingPool.findOneAndUpdate(
        { seasonId: season._id },
        {
          $set: {
            userId: uid,
            assignments: input.assignments.map((a) => ({
              matingId: a.matingId,
              noseGroup: a.noseGroup,
              combos: [...new Set(a.hens.map((h) => h.marking))],
            })),
            usedCombos: [...uniqueCombos],
            generatedAt: new Date(),
          },
        },
        { upsert: true },
      )

      // Mark season as generated
      await Season.updateOne(
        { _id: season._id, userId: uid },
        { $set: { markingsGenerated: true, generatedAt: new Date() } },
      )

      return reply.send({ message: 'Markings confirmed and saved' })
    },
  )

  // ── POST /api/seasons/:seasonId/generate/swap ─────────────────
  // Swap a single combo in review (returns updated preview, not saved)
  fastify.post<{ Params: { seasonId: string } }>('/:seasonId/generate/swap', async (req, reply) => {
    const SwapSchema = z.object({
      matingId: z.string(),
      henName: z.string(),
      newMarking: z.string(),
    })
    const { matingId, henName, newMarking } = SwapSchema.parse(req.body)

    const uid = userId(req)
    const season = await requireSeason(req.params.seasonId, uid)
    if (!season) return notFound(reply, 'Season not found')

    if (!isValidCombo(newMarking)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `"${newMarking}" is not a valid marking combination`,
        statusCode: 400,
      })
    }

    const mating = await Mating.findOne({ _id: matingId, seasonId: season._id, userId: uid })
    if (!mating) return notFound(reply, 'Mating not found')

    const hen = mating.hens.find((h) => h.henName === henName)
    if (!hen) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `Hen "${henName}" not found in this mating`,
        statusCode: 400,
      })
    }

    // Validate the new marking belongs to the correct nose group for this mating
    // (client may swap freely — we return the valid options they can choose from)
    const validCombos = getAllValidCombos()
    if (!validCombos.includes(newMarking)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `"${newMarking}" is not in the valid combo pool`,
        statusCode: 400,
      })
    }

    return reply.send({
      matingId,
      henName,
      newMarking,
      message: 'Swap accepted — call /confirm to persist',
    })
  })

  // ── POST /api/seasons/:seasonId/duplicate ─────────────────────
  // Copy a season's matings into a new season (for the current year)
  fastify.post<{ Params: { seasonId: string } }>('/:seasonId/duplicate', async (req, reply) => {
    const uid = userId(req)
    const source = await requireSeason(req.params.seasonId, uid)
    if (!source) return notFound(reply, 'Season not found')

    const year = new Date().getFullYear()
    const newSeason = await Season.create({ userId: uid, name: source.name, year })

    const sourceMatings = await Mating.find({ seasonId: source._id, userId: uid }).sort({ createdAt: 1 })

    await Promise.all(
      sourceMatings.map((m) =>
        Mating.create({
          seasonId: newSeason._id,
          userId: uid,
          maleName: m.maleName,
          sameMarking: m.sameMarking,
          mandatoryMarking: null,
          hens: m.hens.map((h) => ({
            henName: h.henName,
            marking: null,
            previousMarking: h.marking ?? null,
          })),
        }),
      ),
    )

    return reply.code(201).send({
      season: { ...serializeSeason(newSeason), matingCount: sourceMatings.length },
      sourceSeasonName: source.name,
      matingsCopied: sourceMatings.length,
    })
  })

  // ── POST /api/seasons/:seasonId/matings/:matingId/photo ───────
  // Upload male photo
  fastify.post<{ Params: { seasonId: string; matingId: string } }>(
    '/:seasonId/matings/:matingId/photo',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const data = await req.file()
      if (!data) return reply.code(400).send({ error: 'Bad Request', message: 'No file', statusCode: 400 })

      const chunks: Buffer[] = []
      for await (const chunk of data.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const buffer = Buffer.concat(chunks)
      const url = await fastify.storage.uploadBuffer(buffer, data.filename || 'photo.jpg', data.mimetype, 'mating-photos')

      const mating = await Mating.findOneAndUpdate(
        { _id: req.params.matingId, seasonId: season._id, userId: uid },
        { $set: { malePhoto: url } },
        { new: true },
      )
      if (!mating) return notFound(reply, 'Mating not found')
      return serializeMating(mating)
    },
  )

  // ── DELETE /api/seasons/:seasonId/matings/:matingId/photo ──────
  fastify.delete<{ Params: { seasonId: string; matingId: string } }>(
    '/:seasonId/matings/:matingId/photo',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const mating = await Mating.findOne({ _id: req.params.matingId, seasonId: season._id, userId: uid })
      if (!mating) return notFound(reply, 'Mating not found')

      if (mating.malePhoto) {
        await fastify.storage.deleteFile(mating.malePhoto).catch(() => {})
      }
      mating.malePhoto = null
      await mating.save()
      return serializeMating(mating)
    },
  )

  // ── POST /api/seasons/:seasonId/matings/:matingId/hens/:henId/photo ──
  // Upload hen photo
  fastify.post<{ Params: { seasonId: string; matingId: string; henId: string } }>(
    '/:seasonId/matings/:matingId/hens/:henId/photo',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const data = await req.file()
      if (!data) return reply.code(400).send({ error: 'Bad Request', message: 'No file', statusCode: 400 })

      const mating = await Mating.findOne({ _id: req.params.matingId, seasonId: season._id, userId: uid })
      if (!mating) return notFound(reply, 'Mating not found')

      const henIdx = mating.hens.findIndex((h) => h._id.toString() === req.params.henId)
      if (henIdx === -1) return notFound(reply, 'Hen not found')

      const chunks: Buffer[] = []
      for await (const chunk of data.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const buffer = Buffer.concat(chunks)
      const url = await fastify.storage.uploadBuffer(buffer, data.filename || 'photo.jpg', data.mimetype, 'hen-photos')

      const updated = await Mating.findOneAndUpdate(
        { _id: req.params.matingId, seasonId: season._id, userId: uid },
        { $set: { [`hens.${henIdx}.photo`]: url } },
        { new: true },
      )
      if (!updated) return notFound(reply, 'Mating not found')
      return serializeMating(updated)
    },
  )

  // ── DELETE /api/seasons/:seasonId/matings/:matingId/hens/:henId/photo ──
  fastify.delete<{ Params: { seasonId: string; matingId: string; henId: string } }>(
    '/:seasonId/matings/:matingId/hens/:henId/photo',
    async (req, reply) => {
      const uid = userId(req)
      const season = await requireSeason(req.params.seasonId, uid)
      if (!season) return notFound(reply, 'Season not found')

      const mating = await Mating.findOne({ _id: req.params.matingId, seasonId: season._id, userId: uid })
      if (!mating) return notFound(reply, 'Mating not found')

      const henIdx = mating.hens.findIndex((h) => h._id.toString() === req.params.henId)
      if (henIdx === -1) return notFound(reply, 'Hen not found')

      const existingPhoto = mating.hens[henIdx]!.photo
      if (existingPhoto) {
        await fastify.storage.deleteFile(existingPhoto).catch(() => {})
      }

      const updated = await Mating.findOneAndUpdate(
        { _id: req.params.matingId, seasonId: season._id, userId: uid },
        { $set: { [`hens.${henIdx}.photo`]: null } },
        { new: true },
      )
      if (!updated) return notFound(reply, 'Mating not found')
      return serializeMating(updated)
    },
  )

  // ── DELETE /api/seasons/:seasonId/generate ────────────────────
  // Reset markings — clear generated data, allow re-generation
  fastify.delete<{ Params: { seasonId: string } }>('/:seasonId/generate', async (req, reply) => {
    const uid = userId(req)
    const season = await requireSeason(req.params.seasonId, uid)
    if (!season) return notFound(reply, 'Season not found')

    // Clear noseGroup + hen markings from all matings
    await Mating.updateMany(
      { seasonId: season._id, userId: uid },
      { $set: { noseGroup: null, 'hens.$[].marking': null } },
    )

    // Remove marking pool
    await MarkingPool.deleteOne({ seasonId: season._id, userId: uid })

    // Unmark season
    await Season.updateOne(
      { _id: season._id, userId: uid },
      { $set: { markingsGenerated: false, generatedAt: null } },
    )

    return reply.send({ message: 'Markings reset' })
  })
}

// ─── serializers ─────────────────────────────────────────────────────────────

function serializeSeason(s: ISeason) {
  return {
    _id: s._id.toString(),
    name: s.name,
    year: s.year,
    markingsGenerated: s.markingsGenerated,
    generatedAt: s.generatedAt?.toISOString() ?? null,
    eggsLaid: s.eggsLaid ?? null,
    expectedHatchDate: s.expectedHatchDate?.toISOString() ?? null,
    chicksHatched: s.chicksHatched ?? null,
    hatchRate: s.hatchRate ?? null,
    maleCount: s.maleCount ?? null,
    femaleCount: s.femaleCount ?? null,
    sexCountDone: s.sexCountDone ?? false,
    sexCountUpdatedAt: s.sexCountUpdatedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

function serializeMating(m: IMating) {
  const useIndividual = m.useIndividualHenCount ?? false

  // Compute totals from hen-level data when in individual mode
  const totalEggs = useIndividual
    ? m.hens.reduce((s, h) => s + (h.eggsLaid ?? 0), 0)
    : (m.penEggsLaid ?? null)
  const totalHatched = useIndividual
    ? m.hens.reduce((s, h) => s + (h.chicksHatched ?? 0), 0)
    : (m.penChicksHatched ?? null)
  const totalMales = useIndividual
    ? m.hens.reduce((s, h) => s + (h.maleCount ?? 0), 0)
    : (m.penMaleCount ?? null)
  const totalFemales = useIndividual
    ? m.hens.reduce((s, h) => s + (h.femaleCount ?? 0), 0)
    : (m.penFemaleCount ?? null)

  // Only include totals if any data has been entered
  const hasData = useIndividual
    ? m.hens.some((h) => h.eggsLaid !== null)
    : m.penEggsLaid !== null

  return {
    _id: m._id.toString(),
    seasonId: m.seasonId.toString(),
    maleName: m.maleName,
    noseGroup: m.noseGroup,
    sameMarking: m.sameMarking,
    mandatoryMarking: m.mandatoryMarking,
    hens: m.hens.map((h) => ({
      _id: h._id.toString(),
      henName: h.henName,
      marking: h.marking,
      previousMarking: h.previousMarking ?? null,
      photo: h.photo ?? null,
      eggsLaid: h.eggsLaid ?? null,
      chicksHatched: h.chicksHatched ?? null,
      maleCount: h.maleCount ?? null,
      femaleCount: h.femaleCount ?? null,
    })),
    useIndividualHenCount: useIndividual,
    penEggsLaid: m.penEggsLaid ?? null,
    penChicksHatched: m.penChicksHatched ?? null,
    penMaleCount: m.penMaleCount ?? null,
    penFemaleCount: m.penFemaleCount ?? null,
    // Computed totals (null if no data entered yet)
    totalEggsLaid: hasData ? totalEggs : null,
    totalChicksHatched: hasData ? totalHatched : null,
    totalMaleCount: hasData ? totalMales : null,
    totalFemaleCount: hasData ? totalFemales : null,
    malePhoto: m.malePhoto ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}
