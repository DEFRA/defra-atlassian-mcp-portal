import nock from 'nock'

import { createServer } from '../../../../src/server/server.js'
import { get } from '../../../helpers/server.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../helpers/login.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'
const AUTHORIZE_URL = 'https://atlassian.co/oauth/authorize?state=abc'

/**
 * The linking page reads the connection and nothing else - the steps describe
 * the connection itself, so no board lookup is involved.
 *
 * A linked user also has their connection tested, so that interceptor is only
 * registered when there is a connection to test. Pass `check: null` to leave it
 * off and let the call fail, which is what an older atlassian-mcp without the
 * endpoint looks like.
 */
function mockLinkingStatus ({ linked, check = { ok: true, profile: { firstName: 'Dev', lastName: 'User' } } }) {
  nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked })

  if (!linked) {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/authorization-url')
      .reply(200, { authorizationUrl: AUTHORIZE_URL })
  }

  if (linked && check) {
    nock(ATLASSIAN_MCP_URL).get('/linking/test-connection').reply(200, check)
  }
}

describe('linkingController', () => {
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

    describe('GET /account/atlassian-linking', () => {
      test('titles the page for the connection rather than instructing the user to make one', async () => {
        mockLinkingStatus({ linked: true })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('<h1 class="govuk-heading-l">Your Atlassian connection</h1>')
        expect(response.result).not.toContain('<h1 class="govuk-heading-xl">Connect your Atlassian account</h1>')
      })

      test('shows the connection steps whatever the connection state', async () => {
        mockLinkingStatus({ linked: true })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.result).toContain('defra-check-steps')
        expect(response.result).toContain('Sign in to the portal')
        expect(response.result).toContain('Connect your Atlassian account')
      })

      test('does not test a connection that does not exist', async () => {
        const check = nock(ATLASSIAN_MCP_URL).get('/linking/test-connection').reply(200, { ok: true })
        mockLinkingStatus({ linked: false })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.result).toContain('Runs once your Atlassian account is connected.')
        expect(check.isDone()).toBe(false)
      })

      test('offers the connect action once, as a button rather than also as a step link', async () => {
        mockLinkingStatus({ linked: false })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.result).toContain('class="govuk-button')
        expect(response.result).not.toContain('defra-check-steps__link')
      })

      test('explains the connection in every state, not only when disconnected', async () => {
        mockLinkingStatus({ linked: true })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.result).toContain('What happens when I connect?')
        expect(response.result).toContain('What is this connection for?')
      })
    })

    describe('when the account is connected', () => {
      test('marks the connection step green and drops the connect button', async () => {
        mockLinkingStatus({ linked: true })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.result).toContain('defra-check-steps__circle--linked')
        expect(response.result).not.toContain('Connect Atlassian account')
      })

      test.skip('confirms Atlassian MCP can reach Atlassian, naming the profile it loaded', async () => {
        mockLinkingStatus({ linked: true })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.result).toContain('defra-check-steps__circle--working')
        expect(response.result).toContain('Atlassian MCP can reach Atlassian as Dev User.')
      })
    })

    describe('when the Atlassian MCP server has no test-connection endpoint yet', () => {
      test('leaves the check unrun rather than reporting a broken connection', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })
        nock(ATLASSIAN_MCP_URL).get('/linking/test-connection').reply(404, { detail: 'Not Found' })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('Your connection may still be fine.')
        expect(response.result).not.toContain('defra-check-steps__circle--issue')
        expect(response.result).not.toContain('Reconnect Atlassian account')
      })
    })

    describe('when the account is not connected', () => {
      test('offers the connect button, pointing at the authorization url', async () => {
        mockLinkingStatus({ linked: false })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('Connect Atlassian account')
        expect(response.result).toContain(AUTHORIZE_URL)
        expect(response.result).toContain('Not connected')
      })
    })

    describe('when the connection status cannot be checked', () => {
      test('flags the connection step as an issue and offers a retry', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(500, { error: 'Internal server error' })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('defra-check-steps__circle--issue')
        expect(response.result).toContain('Check your connection again')
        expect(response.result).not.toContain('Connect Atlassian account')
      })
    })

    describe('when a gated route sent the user here', () => {
      test('says what they were trying to do', async () => {
        // Being stopped by the gate is what stashes the reason.
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: false })
        const gated = await get(server, '/space-requests/new', authCookie)
        const cookie = mergeCookies(authCookie, gated.headers['set-cookie'])

        expect(gated.headers.location).toBe('/account/atlassian-linking')

        mockLinkingStatus({ linked: false })
        const response = await get(server, '/account/atlassian-linking', cookie)

        expect(response.statusCode).toBe(200)
        expect(response.result).toContain('You need to connect your Atlassian account to request a space.')
      })

      test('sends them straight on if they connected in the meantime', async () => {
        nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: false })
        const gated = await get(server, '/space-requests/new', authCookie)
        const cookie = mergeCookies(authCookie, gated.headers['set-cookie'])

        // Connected since being stopped - in another tab, or by going back.
        mockLinkingStatus({ linked: true })
        const response = await get(server, '/account/atlassian-linking', cookie)

        expect(response.statusCode).toBe(302)
        expect(response.headers.location).toBe('/space-requests/new')
      })
    })

    describe('when the user came here of their own accord', () => {
      test('shows no interrupted-action banner', async () => {
        mockLinkingStatus({ linked: false })

        const response = await get(server, '/account/atlassian-linking', authCookie)

        expect(response.result).not.toContain('You need to connect your Atlassian account to')
      })
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

    test('GET /account/atlassian-linking redirects to sign in', async () => {
      const response = await get(server, '/account/atlassian-linking')

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/')
    })
  })
})
