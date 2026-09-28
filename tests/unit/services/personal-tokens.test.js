import { mintedToken, tokenSummary } from '../../fixtures/atlassian-mcp.js'

import * as tokensApi from '../../../src/infra/atlassian/tokens.js'
import {
  listTokens,
  mintToken,
  revokeToken
} from '../../../src/services/personal-tokens.js'

vi.mock('../../../src/infra/atlassian/tokens.js')

const USER = 'test@example.com'

const ok = (data, status = 200) => ({ ok: true, status, data })
const notOk = (status) => ({ ok: false, status, data: null })

/** An expiry comfortably in the future, whatever day the suite runs. */
const future = () => new Date(Date.now() + 86400000).toISOString()
const past = () => new Date(Date.now() - 86400000).toISOString()

describe('personalTokensService', () => {
  describe('listTokens', () => {
    test('maps upstream\'s snake_case summary onto the portal\'s own field names', async () => {
      tokensApi.listTokens.mockResolvedValue(ok([
        tokenSummary({
          id: 'pat_1',
          label: 'Claude Code',
          prefix: 'amcp_xJ8v3kQz',
          created_at: '2026-08-30T10:15:30.000Z',
          expires_at: future(),
          last_used_at: '2026-08-31T09:00:00.000Z',
          revoked_at: null,
          status: 'active'
        })
      ]))

      const { tokens } = await listTokens(USER)

      expect(tokens[0]).toEqual({
        id: 'pat_1',
        label: 'Claude Code',
        prefix: 'amcp_xJ8v3kQz',
        createdAt: '2026-08-30T10:15:30.000Z',
        expiresAt: expect.any(String),
        lastUsedAt: '2026-08-31T09:00:00.000Z',
        revokedAt: null,
        status: 'active'
      })
    })

    describe('deriving the status upstream does not send', () => {
      test('calls an unrevoked token with a future expiry active', async () => {
        tokensApi.listTokens.mockResolvedValue(ok([
          tokenSummary({ expires_at: future(), revoked_at: null, status: 'active' })
        ]))

        const { tokens } = await listTokens(USER)

        expect(tokens[0].status).toBe('active')
      })

      test('calls an unrevoked token whose expiry has passed expired', async () => {
        tokensApi.listTokens.mockResolvedValue(ok([
          tokenSummary({ expires_at: past(), revoked_at: null, status: 'expired' })
        ]))

        const { tokens } = await listTokens(USER)

        expect(tokens[0].status).toBe('expired')
      })

      test('calls a revoked token revoked even once its expiry has also passed', async () => {
        tokensApi.listTokens.mockResolvedValue(ok([
          tokenSummary({ expires_at: past(), revoked_at: past(), status: 'revoked' })
        ]))

        const { tokens } = await listTokens(USER)

        expect(tokens[0].status).toBe('revoked')
      })
    })

    describe('when the tokens API cannot be reached', () => {
      test('reports the failure rather than an empty list, so the page can say so', async () => {
        tokensApi.listTokens.mockRejectedValue(new Error('ECONNREFUSED'))

        await expect(listTokens(USER)).resolves.toEqual({ tokens: [], listError: true })
      })

      test('treats an unexpected status the same way', async () => {
        tokensApi.listTokens.mockResolvedValue(notOk(503))

        await expect(listTokens(USER)).resolves.toEqual({ tokens: [], listError: true })
      })
    })

    test('puts the newest token first', async () => {
      tokensApi.listTokens.mockResolvedValue(ok([
        tokenSummary({ id: 'older', created_at: '2026-01-01T00:00:00.000Z', expires_at: future(), status: 'active' }),
        tokenSummary({ id: 'newest', created_at: '2026-08-30T00:00:00.000Z', expires_at: future(), status: 'active' }),
        tokenSummary({ id: 'middle', created_at: '2026-05-01T00:00:00.000Z', expires_at: future(), status: 'active' })
      ]))

      const { tokens } = await listTokens(USER)

      expect(tokens.map((token) => token.id)).toEqual(['newest', 'middle', 'older'])
    })

    test('distinguishes a user with no tokens from a failed lookup', async () => {
      tokensApi.listTokens.mockResolvedValue(ok([]))

      await expect(listTokens(USER)).resolves.toEqual({ tokens: [], listError: false })
    })
  })

  describe('mintToken', () => {
    test('returns the plaintext secret under the portal\'s own field names', async () => {
      tokensApi.mintToken.mockResolvedValue(ok(mintedToken({
        id: 'pat_1',
        token: 'amcp_secret',
        label: 'Claude Code',
        expires_at: '2026-11-28T10:15:30.000Z'
      }), 201))

      await expect(mintToken(USER, { label: 'Claude Code', ttlDays: 30 })).resolves.toEqual({
        id: 'pat_1',
        secret: 'amcp_secret',
        label: 'Claude Code',
        expiresAt: '2026-11-28T10:15:30.000Z'
      })
    })

    test('passes the label and lifetime through to the API', async () => {
      tokensApi.mintToken.mockResolvedValue(ok(mintedToken(), 201))

      await mintToken(USER, { label: 'Claude Code', ttlDays: 30 })

      expect(tokensApi.mintToken).toHaveBeenCalledWith(USER, { label: 'Claude Code', ttlDays: 30 })
    })

    test('throws rather than reporting an empty success, so no user believes they hold a token they never got', async () => {
      tokensApi.mintToken.mockResolvedValue(notOk(503))

      await expect(
        mintToken(USER, { label: 'Claude Code', ttlDays: 30 })
      ).rejects.toMatchObject({ statusCode: 503 })
    })
  })

  describe('revokeToken', () => {
    test('reports success on an empty 204', async () => {
      tokensApi.revokeToken.mockResolvedValue({ ok: true, status: 204, data: null })

      await expect(revokeToken(USER, 'pat_1')).resolves.toEqual({ success: true, notFound: false })
    })

    test('reports a 404 as not found, covering both a missing token and another user\'s', async () => {
      tokensApi.revokeToken.mockResolvedValue(notOk(404))

      await expect(revokeToken(USER, 'pat_1')).resolves.toEqual({ success: false, notFound: true })
    })

    test('throws on an unexpected status', async () => {
      tokensApi.revokeToken.mockResolvedValue(notOk(500))

      await expect(revokeToken(USER, 'pat_1')).rejects.toMatchObject({ statusCode: 500 })
    })
  })
})
