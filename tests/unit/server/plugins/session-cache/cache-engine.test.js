import { vi } from 'vitest'

import { Engine as CatboxRedis } from '@hapi/catbox-redis'
import { Engine as CatboxMemory } from '@hapi/catbox-memory'

import { getCacheEngine } from '../../../../../src/server/plugins/session-cache/cache-engine.js'
import { config } from '../../../../../src/config/config.js'

const mockLoggerInfo = vi.fn()
const mockLoggerError = vi.fn()

// buildRedisClient is ours, so mocking it is a decision about our own
// boundary - it keeps this test off a real ioredis connection attempt. The
// real @hapi/catbox-redis Engine is left untouched: its constructor does no
// I/O (just Joi validation of the options), so it can run for real here.
vi.mock('../../../../../src/infra/redis-client.js', () => ({
  buildRedisClient: vi.fn(() => ({}))
}))
vi.mock('../../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({
    info: (...args) => mockLoggerInfo(...args),
    error: (...args) => mockLoggerError(...args)
  })
}))

describe('getCacheEngine', () => {
  describe('When Redis cache engine has been requested', () => {
    test('sets up Redis cache', () => {
      const engine = getCacheEngine('redis')

      expect(engine).toBeInstanceOf(CatboxRedis)
    })
  })

  describe('When In memory cache engine has been requested', () => {
    test('sets up in-memory cache', () => {
      const engine = getCacheEngine()

      expect(engine).toBeInstanceOf(CatboxMemory)
    })
  })

  describe('When In memory cache engine has been requested in Production', () => {
    const originalIsProduction = config.get('isProduction')

    beforeEach(() => {
      config.set('isProduction', true)
    })

    afterEach(() => {
      config.set('isProduction', originalIsProduction)
    })

    test('logs a production warning', () => {
      getCacheEngine()

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('production')
      )
    })

    test('sets up in-memory cache', () => {
      const engine = getCacheEngine()

      expect(engine).toBeInstanceOf(CatboxMemory)
    })
  })
})
