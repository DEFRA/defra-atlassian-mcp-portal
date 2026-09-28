import { vi } from 'vitest'

import { connectionChecks } from '../../../src/constants/connection-checks.js'
import { connectionFailureReasons } from '../../../src/constants/connection-failure-reasons.js'
import { linkingOutcomes } from '../../../src/constants/linking-outcomes.js'
import {
  getLinkingStatus,
  isAtlassianLinked,
  completeLinking,
  verifyConnection,
  getAuthorizationUrl
} from '../../../src/services/atlassian-linking.js'

vi.mock('../../../src/infra/atlassian/linking.js')

import * as linkingApi from '../../../src/infra/atlassian/linking.js'

describe('atlassianLinkingService', () => {
  describe('getLinkingStatus', () => {
    test('returns connected status without fetching auth URL', async () => {
      const statusData = { linked: true, expired: false }
      linkingApi.checkLinkingStatus.mockResolvedValue({ ok: true, status: 200, data: statusData })

      const result = await getLinkingStatus('user-123')

      expect(result.linkingStatus).toEqual(statusData)
      expect(result.statusError).toBe(false)
      expect(result.authorizationUrl).toBeNull()
      expect(linkingApi.checkLinkingStatus).toHaveBeenCalledWith('user-123')
      expect(linkingApi.getAuthorizationUrl).not.toHaveBeenCalled()
    })

    test('fetches auth URL when not connected', async () => {
      const statusData = { linked: false }
      const authData = { authorizationUrl: 'https://atlassian.co/oauth/authorize?state=abc' }

      linkingApi.checkLinkingStatus.mockResolvedValue({ ok: true, status: 200, data: statusData })
      linkingApi.getAuthorizationUrl.mockResolvedValue({ ok: true, status: 200, data: authData })

      const result = await getLinkingStatus('user-123')

      expect(result.linkingStatus).toEqual(statusData)
      expect(result.statusError).toBe(false)
      expect(result.authorizationUrl).toBe('https://atlassian.co/oauth/authorize?state=abc')
      expect(linkingApi.getAuthorizationUrl).toHaveBeenCalledWith('user-123')
    })

    test('returns error state when status fetch throws', async () => {
      const error = new Error('Network error')
      error.name = 'AtlassianMcpError'
      linkingApi.checkLinkingStatus.mockRejectedValue(error)

      const result = await getLinkingStatus('user-123')

      expect(result.linkingStatus).toBeNull()
      expect(result.statusError).toBe(true)
      expect(result.authorizationUrl).toBeNull()
      expect(linkingApi.getAuthorizationUrl).not.toHaveBeenCalled()
    })

    test('returns error state when auth URL fetch throws', async () => {
      const statusData = { linked: false }
      const error = new Error('Network timeout')
      error.name = 'AtlassianMcpError'

      linkingApi.checkLinkingStatus.mockResolvedValue({ ok: true, status: 200, data: statusData })
      linkingApi.getAuthorizationUrl.mockRejectedValue(error)

      const result = await getLinkingStatus('user-123')

      expect(result.linkingStatus).toBeNull()
      expect(result.statusError).toBe(true)
      expect(result.authorizationUrl).toBeNull()
    })
  })

  describe('isAtlassianLinked', () => {
    test('returns true when connected', async () => {
      linkingApi.checkLinkingStatus.mockResolvedValue({ ok: true, status: 200, data: { linked: true } })

      const result = await isAtlassianLinked('user-123')

      expect(result).toBe(true)
      expect(linkingApi.checkLinkingStatus).toHaveBeenCalledWith('user-123')
      expect(linkingApi.getAuthorizationUrl).not.toHaveBeenCalled()
    })

    test('returns false when not connected', async () => {
      linkingApi.checkLinkingStatus.mockResolvedValue({ ok: true, status: 200, data: { linked: false } })

      const result = await isAtlassianLinked('user-123')

      expect(result).toBe(false)
    })

    test('returns false (fails closed) when the status fetch throws', async () => {
      const error = new Error('Network error')
      error.name = 'AtlassianMcpError'
      linkingApi.checkLinkingStatus.mockRejectedValue(error)

      const result = await isAtlassianLinked('user-123')

      expect(result).toBe(false)
    })
  })

  describe('completeLinking', () => {
    test('returns success on 200', async () => {
      linkingApi.completeLinking.mockResolvedValue({ ok: true, status: 200, data: { linked: true } })

      const result = await completeLinking('user-123', { code: 'auth-code', state: 'state-xyz' })

      expect(result).toEqual({ outcome: linkingOutcomes.SUCCESS })
      expect(linkingApi.completeLinking).toHaveBeenCalledWith('user-123', { code: 'auth-code', state: 'state-xyz' })
    })

    test('returns validation_failed on 400', async () => {
      linkingApi.completeLinking.mockResolvedValue({ ok: false, status: 400, data: { detail: 'OAuth state mismatch' } })

      const result = await completeLinking('user-123', { code: 'bad-code', state: 'bad-state' })

      expect(result).toEqual({ outcome: linkingOutcomes.VALIDATION_FAILED })
    })

    test('returns failed when infra throws (unexpected error)', async () => {
      const error = new Error('Network error')
      error.name = 'AtlassianMcpError'
      linkingApi.completeLinking.mockRejectedValue(error)

      const result = await completeLinking('user-123', { code: 'code', state: 'state' })

      expect(result).toEqual({ outcome: linkingOutcomes.FAILED })
    })
  })

  describe('verifyConnection', () => {
    test('reports a working connection and carries the profile through', async () => {
      linkingApi.testConnection.mockResolvedValue({
        ok: true,
        status: 200,
        data: { status: 'success', profile: { email: 'dev@example.com' } }
      })

      const result = await verifyConnection('dev@example.com')

      expect(result).toEqual({
        state: connectionChecks.VERIFIED,
        profile: { email: 'dev@example.com' },
        reason: null
      })
    })

    test('reports a refusal as unauthorized when Atlassian rejects the token', async () => {
      linkingApi.testConnection.mockResolvedValue({ ok: false, status: 401, data: null })

      const result = await verifyConnection('dev@example.com')

      expect(result).toMatchObject({
        state: connectionChecks.FAILED,
        reason: connectionFailureReasons.UNAUTHORIZED
      })
    })

    test('reports a refusal as a Atlassian API error on a bad gateway', async () => {
      linkingApi.testConnection.mockResolvedValue({ ok: false, status: 502, data: null })

      const result = await verifyConnection('dev@example.com')

      expect(result).toMatchObject({
        state: connectionChecks.FAILED,
        reason: connectionFailureReasons.ATLASSIAN_API_ERROR
      })
    })

    test('reports unavailable, not failed, when the server has no such endpoint', async () => {
      // A 404 is not in the infra layer's expected list, so it throws rather
      // than coming back as a response - that says nothing about the
      // connection, so it must never surface as a broken one.
      linkingApi.testConnection.mockRejectedValue(new Error('Unexpected status 404'))

      const result = await verifyConnection('dev@example.com')

      expect(result.state).toBe(connectionChecks.UNAVAILABLE)
    })

    test('reports unavailable when the call throws', async () => {
      linkingApi.testConnection.mockRejectedValue(new Error('ECONNREFUSED'))

      const result = await verifyConnection('dev@example.com')

      expect(result.state).toBe(connectionChecks.UNAVAILABLE)
    })

    test('reports unavailable when the body is missing', async () => {
      linkingApi.testConnection.mockResolvedValue({ ok: true, status: 200, data: null })

      const result = await verifyConnection('dev@example.com')

      expect(result.state).toBe(connectionChecks.UNAVAILABLE)
    })
  })

  describe('getAuthorizationUrl', () => {
    test('returns the url the API gave', async () => {
      linkingApi.getAuthorizationUrl.mockResolvedValue({
        ok: true,
        status: 200,
        data: { authorizationUrl: 'https://atlassian.example/authorize' }
      })

      expect(await getAuthorizationUrl('dev@example.com')).toBe('https://atlassian.example/authorize')
    })

    test('returns null rather than throwing, so a failed reconnect link cannot break the page', async () => {
      linkingApi.getAuthorizationUrl.mockRejectedValue(new Error('ECONNREFUSED'))

      expect(await getAuthorizationUrl('dev@example.com')).toBeNull()
    })
  })
})
