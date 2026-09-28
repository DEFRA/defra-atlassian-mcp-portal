import nock from 'nock'
import { AtlassianClient } from '../../../../src/infra/atlassian/client.js'
import { config } from '../../../../src/config/config.js'

const TEST_BASE_URL = 'http://test-atlassian.local'

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('atlassianClient', () => {
  describe('constructor', () => {
    test('uses provided baseUrl when supplied', () => {
      const client = new AtlassianClient('http://custom.url')
      expect(client.baseUrl).toBe('http://custom.url')
    })

    test('defaults to config baseUrl when not supplied', () => {
      const client = new AtlassianClient()
      expect(client.baseUrl).toBe(config.get('atlassianMcp.url'))
    })
  })

  describe('request', () => {
    test('sends GET request with userId header', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .matchHeader('X-User-Id', 'user-123')
        .get('/test-endpoint')
        .reply(200, { result: 'ok' })

      const response = await client.request('/test-endpoint', { userId: 'user-123' })

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ result: 'ok' })
    })

    test('sends POST request with body', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .matchHeader('X-User-Id', 'user-123')
        .post('/test-endpoint', { foo: 'bar' })
        .reply(201, { created: true })

      const response = await client.request('/test-endpoint', {
        method: 'POST',
        body: { foo: 'bar' },
        userId: 'user-123'
      })

      expect(response.ok).toBe(true)
      expect(response.status).toBe(201)
      expect(response.data).toEqual({ created: true })
    })

    test('includes Content-Type header when body is provided', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .matchHeader('Content-Type', 'application/json')
        .post('/test-endpoint', { data: 'test' })
        .reply(200, { ok: true })

      const response = await client.request('/test-endpoint', {
        method: 'POST',
        body: { data: 'test' }
      })

      expect(response.ok).toBe(true)
      expect(nock.isDone()).toBe(true)
    })

    test('throws AtlassianMcpError with preserved status code and message on unexpected 400', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)
      const errorBody = { detail: 'OAuth state mismatch' }

      nock(TEST_BASE_URL)
        .get('/test-endpoint')
        .reply(400, errorBody)

      await expect(client.request('/test-endpoint')).rejects.toMatchObject({
        name: 'AtlassianMcpError',
        statusCode: 400,
        message: expect.stringMatching(/GET \/test-endpoint failed: 400/)
      })
    })

    test('returns null data when response is not JSON', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .get('/test-endpoint')
        .reply(200, 'plain text response')

      const response = await client.request('/test-endpoint')

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      expect(response.data).toBeNull()
    })

    test('returns null data when response body is empty', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .get('/test-endpoint')
        .reply(204, '')

      const response = await client.request('/test-endpoint')

      expect(response.ok).toBe(true)
      expect(response.status).toBe(204)
      expect(response.data).toBeNull()
    })

    test('returns {ok:false, status} when status is in expected array', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .get('/test-endpoint')
        .reply(404, { error: 'not found' })

      const response = await client.request('/test-endpoint', {
        expected: [404]
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
      expect(response.data).toBeNull()
    })

    test('throws AtlassianMcpError with statusCode and method preserved on POST failure', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .post('/test-endpoint')
        .reply(503, { error: 'unavailable' })

      await expect(client.request('/test-endpoint', { method: 'POST' })).rejects.toMatchObject({
        name: 'AtlassianMcpError',
        statusCode: 503,
        message: expect.stringMatching(/POST \/test-endpoint/)
      })
    })

    test('throws AtlassianMcpError even when expected array is empty', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .get('/test-endpoint')
        .reply(400, { detail: 'validation error' })

      await expect(client.request('/test-endpoint', { expected: [] }))
        .rejects.toMatchObject({
          name: 'AtlassianMcpError',
          statusCode: 400
        })
    })

    test('merges additional headers with defaults', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .matchHeader('X-User-Id', 'user-123')
        .matchHeader('X-Custom-Header', 'custom-value')
        .get('/test-endpoint')
        .reply(200, { ok: true })

      const response = await client.request('/test-endpoint', {
        userId: 'user-123',
        headers: { 'X-Custom-Header': 'custom-value' }
      })

      expect(response.ok).toBe(true)
    })

    test('does not include body in request when method is GET', async () => {
      const client = new AtlassianClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .get('/test-endpoint')
        .reply(200, { ok: true })

      const response = await client.request('/test-endpoint', {
        method: 'GET',
        body: { ignored: 'body' }
      })

      expect(response.ok).toBe(true)
    })
  })
})
