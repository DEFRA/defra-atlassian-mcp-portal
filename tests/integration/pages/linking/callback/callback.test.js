import nock from 'nock'
import { createServer } from '../../../../../src/server/server.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../../helpers/login.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

describe('when authenticated', () => {
  let server
  let authCookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  beforeEach(async () => {
    authCookie = await loginAsDevUser(server)
  })

  test('GET /account/atlassian-linking/callback calls the backend to complete the connection', async () => {
    let callMade = false
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query({ code: 'auth_code_123', state: 'state_xyz' })
      .reply(() => {
        callMade = true
        return [200, { status: 'success' }]
      })

    await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=state_xyz',
      headers: { Cookie: authCookie }
    })

    expect(callMade).toBe(true)
  })

  test('GET /account/atlassian-linking/callback redirects to the linking page on success', async () => {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query(true)
      .reply(200, { status: 'success' })

    const response = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=state_xyz',
      headers: { Cookie: authCookie }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/account/atlassian-linking')
  })

  test('GET /account/atlassian-linking/callback redirects to the linking page when the backend rejects the state (400)', async () => {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query(true)
      .reply(400, { detail: 'OAuth state mismatch' })

    const response = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=invalid_state',
      headers: { Cookie: authCookie }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/account/atlassian-linking')
  })

  test('GET /account/atlassian-linking/callback redirects to the linking page when the backend errors (500)', async () => {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query(true)
      .reply(500, { error: 'Internal server error' })

    const response = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=state_xyz',
      headers: { Cookie: authCookie }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/account/atlassian-linking')
  })

  test('GET /account/atlassian-linking/callback keeps the session alive when the backend errors', async () => {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query(true)
      .reply(500, { error: 'Server error' })

    const response = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=state_xyz',
      headers: { Cookie: authCookie }
    })

    expect(response.statusCode).toBe(302)
    const setCookieHeader = response.headers['set-cookie']
    if (setCookieHeader) {
      const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join(';') : setCookieHeader
      expect(cookieString).not.toMatch(/expires=|Max-Age=0/)
    }
  })

  describe('when the request carries no usable code', () => {
    let callback

    beforeEach(() => {
      callback = nock(ATLASSIAN_MCP_URL)
        .get('/linking/callback')
        .query(true)
        .reply(200, { status: 'success' })
    })

    test('does not call the backend and redirects to the linking page when the code parameter is missing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/account/atlassian-linking/callback?state=state_xyz',
        headers: { Cookie: authCookie }
      })

      expect(callback.isDone()).toBe(false)
      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/account/atlassian-linking')
    })

    test('does not call the backend and redirects to the linking page when the user denied access', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/account/atlassian-linking/callback?error=access_denied',
        headers: { Cookie: authCookie }
      })

      expect(callback.isDone()).toBe(false)
      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/account/atlassian-linking')
    })
  })

  test('GET /account/atlassian-linking/callback redirects back to the original destination when linking was required for a gated page', async () => {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/status')
      .reply(200, { linked: false })

    const gatedResponse = await server.inject({
      method: 'GET',
      url: '/space-requests/new',
      headers: { Cookie: authCookie }
    })

    expect(gatedResponse.headers.location).toBe('/account/atlassian-linking')
    const sessionCookie = mergeCookies(authCookie, gatedResponse.headers['set-cookie'])

    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query(true)
      .reply(200, { status: 'success' })

    const callbackResponse = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=state_xyz',
      headers: { Cookie: sessionCookie }
    })

    expect(callbackResponse.statusCode).toBe(302)
    expect(callbackResponse.headers.location).toBe('/space-requests/new')
  })

  test('the linking page shows the account as connected after a successful callback', async () => {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query(true)
      .reply(200, { status: 'success' })
      .get('/linking/status')
      .reply(200, { linked: true })

    const callbackResponse = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=state_xyz',
      headers: { Cookie: authCookie }
    })

    expect(callbackResponse.statusCode).toBe(302)

    const linkingPageResponse = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking',
      headers: { Cookie: authCookie }
    })

    expect(linkingPageResponse.statusCode).toBe(200)
    expect(linkingPageResponse.result).toContain('Your Atlassian account is connected as dev@example.com')
    expect(linkingPageResponse.result).not.toContain('Not connected')
  })
})

describe('when unauthenticated', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  test('GET /account/atlassian-linking/callback redirects to sign in', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=auth_code_123&state=state_xyz'
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
  })
})
