import nock from 'nock'

import { loginAsDevUser } from '../../../../helpers/login.js'
import { createServer } from '../../../../../src/server/server.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

describe("the mock-consent page (as Mockoon's authorization-url response routes to)", () => {
  let server
  let cookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()

    cookie = await loginAsDevUser(server)
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  test('the linking page points at the simulated consent page while unlinked', async () => {
    nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: false })
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/authorization-url')
      .reply(200, { authorizationUrl: '/account/atlassian-linking/mock-consent' })

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking',
      headers: { Cookie: cookie }
    })

    expect(statusCode).toBe(200)
    expect(result).toContain('Not connected')
    expect(result).toContain('href="/account/atlassian-linking/mock-consent"')
  })

  test('GET /account/atlassian-linking/mock-consent renders the simulated consent page', async () => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/mock-consent',
      headers: { Cookie: cookie }
    })

    expect(statusCode).toBe(200)
    expect(result).toContain('This is not a real Atlassian page.')
    expect(result).toContain('href="/account/atlassian-linking/callback?code=mock-code&amp;state=mock-state"')
  })

  test('denying on the consent page does not link the account, and makes no network call', async () => {
    const callback = nock(ATLASSIAN_MCP_URL).get('/linking/callback').query(true).reply(200, { status: 'success' })

    const denyResponse = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?error=access_denied',
      headers: { Cookie: cookie }
    })

    expect(denyResponse.statusCode).toBe(302)
    expect(callback.isDone()).toBe(false)

    nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: false })
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/authorization-url')
      .reply(200, { authorizationUrl: '/account/atlassian-linking/mock-consent' })

    const linkingPageResponse = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking',
      headers: { Cookie: cookie }
    })

    expect(linkingPageResponse.result).toContain('Not connected')
  })

  test('approving on the consent page completes the callback and links the account', async () => {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/callback')
      .query({ code: 'mock-code', state: 'mock-state' })
      .reply(200, { status: 'success' })

    const callbackResponse = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking/callback?code=mock-code&state=mock-state',
      headers: { Cookie: cookie }
    })

    expect(callbackResponse.statusCode).toBe(302)
    expect(callbackResponse.headers.location).toBe('/account/atlassian-linking')

    nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })
    nock(ATLASSIAN_MCP_URL).get('/linking/test-connection').reply(404, { detail: 'Not Found' })

    const linkingPageResponse = await server.inject({
      method: 'GET',
      url: '/account/atlassian-linking',
      headers: { Cookie: cookie }
    })

    expect(linkingPageResponse.statusCode).toBe(200)
    expect(linkingPageResponse.result).toContain('Your Atlassian account is connected as dev@example.com')
  })
})
