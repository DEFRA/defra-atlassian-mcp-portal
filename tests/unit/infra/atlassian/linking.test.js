import nock from 'nock'
import {
  getAuthorizationUrl,
  checkLinkingStatus,
  completeLinking,
  testConnection
} from '../../../../src/infra/atlassian/linking.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('linkingApi', () => {
  describe('getAuthorizationUrl', () => {
    test('returns ok:true with authorization URL on 200', async () => {
      const responseBody = { authorizationUrl: 'https://atlassian.co/oauth/authorize?client_id=123&state=abc' }

      nock(ATLASSIAN_MCP_URL)
        .get('/linking/authorization-url')
        .reply(200, responseBody)

      const result = await getAuthorizationUrl('user-123')

      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toEqual(responseBody)
      expect(result.data.authorizationUrl).toMatch(/https:\/\/atlassian\.co/)
    })

    test('sends the userId as the X-User-Id header', async () => {
      nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'user-xyz-456')
        .get('/linking/authorization-url')
        .reply(200, { authorizationUrl: 'https://atlassian.co/oauth/authorize' })

      await getAuthorizationUrl('user-xyz-456')
    })

    test('passes a stub:true field through unmodified, no longer special-cased', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/linking/authorization-url')
        .reply(200, { authorizationUrl: 'https://real-consent.example', stub: true })

      const result = await getAuthorizationUrl('user-123')

      expect(result.data).toEqual({ authorizationUrl: 'https://real-consent.example', stub: true })
    })
  })

  describe('checkLinkingStatus', () => {
    test('returns ok:true with connected status', async () => {
      const responseBody = { linked: true, email: 'user@example.com' }

      nock(ATLASSIAN_MCP_URL)
        .get('/linking/status')
        .reply(200, responseBody)

      const result = await checkLinkingStatus('user-123')

      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data.linked).toBe(true)
      expect(result.data.email).toBe('user@example.com')
    })

    test('returns linked: false when not linked', async () => {
      const responseBody = { linked: false }

      nock(ATLASSIAN_MCP_URL)
        .get('/linking/status')
        .reply(200, responseBody)

      const result = await checkLinkingStatus('user-123')

      expect(result.ok).toBe(true)
      expect(result.data.linked).toBe(false)
    })

    test('returns token expiry status when available', async () => {
      const responseBody = { linked: true, email: 'user@example.com', expired: true, expires_at: '2026-08-20T20:00:00Z' }

      nock(ATLASSIAN_MCP_URL)
        .get('/linking/status')
        .reply(200, responseBody)

      const result = await checkLinkingStatus('user-123')

      expect(result.ok).toBe(true)
      expect(result.data.linked).toBe(true)
      expect(result.data.expired).toBe(true)
      expect(result.data.expires_at).toBeDefined()
    })
  })

  describe('completeLinking', () => {
    test('returns ok:true when linking succeeds', async () => {
      const responseBody = { status: 'success' }

      nock(ATLASSIAN_MCP_URL)
        .get('/linking/callback')
        .query({ code: 'auth-code-123', state: 'state-abc' })
        .reply(200, responseBody)

      const result = await completeLinking('user-123', { code: 'auth-code-123', state: 'state-abc' })

      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toEqual(responseBody)
    })

    test('returns ok:false on validation error (400)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/linking/callback')
        .query({ code: 'bad-code', state: 'bad-state' })
        .reply(400, { detail: 'OAuth state mismatch' })

      const result = await completeLinking('user-123', { code: 'bad-code', state: 'bad-state' })

      expect(result.ok).toBe(false)
      expect(result.status).toBe(400)
      expect(result.data).toBeNull()
    })

    test('sends the userId as the X-User-Id header', async () => {
      nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'user-xyz')
        .get('/linking/callback')
        .query(true)
        .reply(200, { status: 'success' })

      await completeLinking('user-xyz', { code: 'code', state: 'state' })
    })
  })

  describe('testConnection', () => {
    test('reports a working connection with the profile Atlassian returned', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/linking/test-connection')
        .reply(200, { ok: true, profile: { id: 'u1', email: 'dev@example.com' } })

      const result = await testConnection('dev@example.com')

      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ ok: true, profile: { id: 'u1', email: 'dev@example.com' } })
    })

    test('sends the caller email as the X-User-Id header', async () => {
      const scope = nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'dev@example.com')
        .get('/linking/test-connection')
        .reply(200, { ok: true })

      await testConnection('dev@example.com')

      expect(scope.isDone()).toBe(true)
    })

    test('passes through a refusal without throwing, so the page can explain it', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/linking/test-connection')
        .reply(200, { ok: false, reason: 'Token expired.' })

      const result = await testConnection('dev@example.com')

      expect(result.data).toEqual({ ok: false, reason: 'Token expired.' })
    })

    test('treats a 401 as expected, so the portal can handle unauthorized access gracefully', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/linking/test-connection')
        .reply(401, { detail: 'Unauthorized' })

      const result = await testConnection('dev@example.com')

      expect(result).toEqual({ ok: false, status: 401, data: null })
    })

    test('treats a 502 as expected, so the portal can handle server errors gracefully', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/linking/test-connection')
        .reply(502, { detail: 'Bad Gateway' })

      const result = await testConnection('dev@example.com')

      expect(result).toEqual({ ok: false, status: 502, data: null })
    })

    test('throws AtlassianMcpError on an unexpected status (500)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/linking/test-connection')
        .reply(500, { message: 'Internal server error' })

      await expect(testConnection('dev@example.com'))
        .rejects.toMatchObject({ name: 'AtlassianMcpError', statusCode: 500 })
    })
  })
})
