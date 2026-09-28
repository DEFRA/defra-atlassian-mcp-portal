import nock from 'nock'

import { createServer } from '../../../../src/server/server.js'
import { get } from '../../../helpers/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

describe('dashboardController', () => {
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

    describe('GET /dashboard', () => {
      test('renders tile links to each onward journey', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })

        const response = await get(server, '/dashboard', authCookie)

        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('href="/spaces"')
        expect(response.result).toContain('href="/approvals"')
        expect(response.result).toContain('href="/space-requests/new"')
        expect(response.result).toContain('href="/account/tokens"')
      })

      test('frames the service as governed access for the MCP server', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })

        const response = await get(server, '/dashboard', authCookie)

        expect(response.result).toContain('Request governed access to Jira and Confluence spaces')
        expect(response.result).toContain('Search spaces governed for MCP use')
        expect(response.result).toContain('approved for use with the MCP server')
      })

      test('leads with a heading rather than a notification banner', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })

        const response = await get(server, '/dashboard', authCookie)

        expect(response.result).toContain('<h1 class="govuk-heading-xl">Manage your Atlassian space access</h1>')
        expect(response.result).not.toContain('govuk-notification-banner')
      })

      test('does not render a count tag when reviewCount defaults to 0', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })

        const response = await get(server, '/dashboard', authCookie)

        // When reviewCount is not provided, it defaults to 0 and should not show a tag
        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('Approvals to review')
        // The tag should not render with a 0 count since `if tile.count` is falsy
        expect(response.result).not.toContain('govuk-tag--red')
      })

      test('shows the connected status when Atlassian is linked', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })

        const response = await get(server, '/dashboard', authCookie)

        expect(response.result).toContain('govuk-tag--green">\n  Connected')
        expect(response.result).not.toContain('Not connected')
      })

      test('shows the not-connected status with a link to connect when Atlassian is not linked', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: false })
        nock(ATLASSIAN_MCP_URL)
          .get('/linking/authorization-url')
          .reply(200, { authorizationUrl: 'https://atlassian.co/oauth/authorize?state=abc' })

        const response = await get(server, '/dashboard', authCookie)

        expect(response.result).toContain('Not connected')
        expect(response.result).toContain('Connect your Atlassian account')
        expect(response.result).toContain('href="/account/atlassian-linking"')
      })

      test('degrades gracefully when the Atlassian status check fails', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(500, { error: 'Internal server error' })

        const response = await get(server, '/dashboard', authCookie)

        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('Unavailable')
        expect(response.result).toContain('connection status')
        expect(response.result).not.toContain('Not connected')
      })
    })
  })

  describe('when unauthenticated', () => {
    let server

    beforeAll(async () => {
      server = await createServer()
      await server.initialize()
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('GET /dashboard redirects to sign in', async () => {
      const response = await get(server, '/dashboard')

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/')
    })
  })
})
