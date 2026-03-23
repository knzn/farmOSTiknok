import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

async function errorsPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, _req, reply) => {
    fastify.log.error(error)

    // Zod validation errors → 400
    // Check name too: instanceof fails across ESM/CJS boundary in Zod 3.25+
    if (error instanceof ZodError || error.name === 'ZodError') {
      const zodError = error as ZodError
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Validation failed',
        details: zodError.flatten().fieldErrors,
        statusCode: 400,
      })
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
        statusCode: 400,
      })
    }

    // Auth errors
    if (error.statusCode === 401) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: error.message,
        statusCode: 401,
      })
    }

    // Not found
    if (error.statusCode === 404) {
      return reply.code(404).send({
        error: 'Not Found',
        message: error.message,
        statusCode: 404,
      })
    }

    // Conflict (duplicate key)
    if (error.statusCode === 409) {
      return reply.code(409).send({
        error: 'Conflict',
        message: error.message,
        statusCode: 409,
      })
    }

    // Default 500
    const statusCode = error.statusCode ?? 500
    return reply.code(statusCode).send({
      error: statusCode === 500 ? 'Internal Server Error' : error.name,
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      statusCode,
    })
  })

  fastify.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: 'Route not found',
      statusCode: 404,
    })
  })
}

export default fp(errorsPlugin, { name: 'errors' })
