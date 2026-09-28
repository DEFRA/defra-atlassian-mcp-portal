import nock from 'nock'

import { mintedToken, tokenSummary, tokenList } from '../../../../fixtures/atlassian-mcp.js'
import { createServer } from '../../../../../src/server/server.js'
import { get, post } from '../../../../helpers/server.js'
import { form } from '../../../../helpers/forms.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../../helpers/login.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

/**
 * Every token page also reports whether Atlassian is connected, because a token
 * that cannot read a board is worth warning about before one is made. Linked
 * by default so tests that are not about the warning do not have to say so.
 */
function mockAtlassianLinked (linked = true) {
  nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked })

  if (!linked) {
    nock(ATLASSIAN_MCP_URL)
      .get('/linking/authorization-url')
      .reply(200, { authorizationUrl: 'https://atlassian.co/oauth/authorize' })
  }
}

const future = () => new Date(Date.now() + 86400000).toISOString()

describe('tokensController', () => {
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

    describe('and atlassian is linked', () => {
      beforeEach(() => {
        mockAtlassianLinked()
      })

      describe('GET /account/tokens', () => {
        test('invites the user to generate one when they have none', async () => {
          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, [])

          const response = await get(server, '/account/tokens', authCookie)

          expect(response.statusCode).toBe(200)
          expect(response.result).toContain('You have not generated any access tokens yet.')
        })

        test('lists each token with its name, prefix and status', async () => {
          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, tokenList([
            tokenSummary({ label: 'Claude Code', prefix: 'amcp_xJ8v3kQz', expires_at: future(), status: 'active' })
          ]))

          const response = await get(server, '/account/tokens', authCookie)

          expect(response.result).toContain('Claude Code')
          expect(response.result).toContain('amcp_xJ8v3kQz')
          expect(response.result).toContain('Active')
        })

        test('never renders a secret, because the listing upstream returns does not carry one', async () => {
          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, tokenList())

          const response = await get(server, '/account/tokens', authCookie)

          expect(response.result).not.toContain(mintedToken().token)
        })

        test('offers no revocation for an already revoked token', async () => {
          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, tokenList([
            tokenSummary({ id: 'pat_1', revoked_at: '2026-08-31T00:00:00.000Z', status: 'revoked' })
          ]))

          const response = await get(server, '/account/tokens', authCookie)

          expect(response.result).toContain('Revoked')
          expect(response.result).not.toContain('/account/tokens/pat_1/revoke')
        })
      })

      describe('POST /account/tokens/new', () => {
        test('redirects to the page that shows the secret', async () => {
          nock(ATLASSIAN_MCP_URL).post('/tokens').reply(201, mintedToken())

          const response = await post(
            server,
            '/account/tokens/new',
            form({ label: 'Claude Code', ttlDays: '30' }),
            authCookie
          )

          expect(response.statusCode).toBe(302)
          expect(response.headers.location).toBe('/account/tokens/created')
        })

        test('sends the chosen lifetime as the ttl_days upstream expects', async () => {
          const scope = nock(ATLASSIAN_MCP_URL)
            .post('/tokens', { label: 'Claude Code', ttl_days: 30 })
            .reply(201, mintedToken())

          await post(
            server,
            '/account/tokens/new',
            form({ label: 'Claude Code', ttlDays: '30' }),
            authCookie
          )

          expect(scope.isDone()).toBe(true)
        })

        test('re-renders the form with an error summary when the token is unnamed', async () => {
          const response = await post(
            server,
            '/account/tokens/new',
            form({ label: '', ttlDays: '30' }),
            authCookie
          )

          expect(response.statusCode).toBe(400)
          expect(response.result).toContain('There is a problem')
          expect(response.result).toContain('Enter a name for this token')
        })
      })

      describe('GET /account/tokens/created', () => {
        let createdCookie

        beforeEach(async () => {
          mockAtlassianLinked()

          nock(ATLASSIAN_MCP_URL).post('/tokens').reply(201, mintedToken({
            token: 'amcp_thesecretvalue',
            label: 'Claude Code'
          }))

          const minted = await post(
            server,
            '/account/tokens/new',
            form({ label: 'Claude Code', ttlDays: '30' }),
            authCookie
          )

          createdCookie = mergeCookies(authCookie, minted.headers['set-cookie'])
        })

        test('shows the secret once, with the warning that it will not be shown again', async () => {
          const response = await get(server, '/account/tokens/created', createdCookie)

          expect(response.statusCode).toBe(200)
          expect(response.result).toContain('amcp_thesecretvalue')
          expect(response.result).toContain('only time this token will be shown')
        })

        test('includes a client configuration carrying the token', async () => {
          const response = await get(server, '/account/tokens/created', createdCookie)

          expect(response.result).toContain('mcpServers')
          expect(response.result).toContain('Bearer amcp_thesecretvalue')
        })

        test('sends a reload back to the listing rather than showing the secret twice', async () => {
          mockAtlassianLinked()
          const first = await get(server, '/account/tokens/created', createdCookie)
          const reloadCookie = mergeCookies(createdCookie, first.headers['set-cookie'])

          const response = await get(server, '/account/tokens/created', reloadCookie)

          expect(response.statusCode).toBe(302)
          expect(response.headers.location).toBe('/account/tokens')
        })

        test('sends a user who never minted anything to the listing', async () => {
          const response = await get(server, '/account/tokens/created', authCookie)

          expect(response.statusCode).toBe(302)
          expect(response.headers.location).toBe('/account/tokens')
        })
      })

      describe('the revoke journey', () => {
        beforeEach(() => {
          mockAtlassianLinked()
        })

        test('names the token on the confirmation page before destroying it', async () => {
          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, tokenList([
            tokenSummary({ id: 'pat_1', label: 'Claude Code', expires_at: future() })
          ]))

          const response = await get(server, '/account/tokens/pat_1/revoke', authCookie)

          expect(response.statusCode).toBe(200)
          expect(response.result).toContain('Are you sure you want to revoke this token?')
          expect(response.result).toContain('Claude Code')
        })

        test('sends a user asking about a token that is not theirs back to the listing', async () => {
          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, [])

          const response = await get(server, '/account/tokens/pat_other/revoke', authCookie)

          expect(response.statusCode).toBe(302)
          expect(response.headers.location).toBe('/account/tokens')
        })

        test('deletes the token upstream and returns to the listing', async () => {
          const scope = nock(ATLASSIAN_MCP_URL).delete('/tokens/pat_1').reply(204)

          const response = await post(
            server,
            '/account/tokens/pat_1/revoke',
            form({ label: 'Claude Code' }),
            authCookie
          )

          expect(scope.isDone()).toBe(true)
          expect(response.statusCode).toBe(302)
          expect(response.headers.location).toBe('/account/tokens')
        })

        test('confirms on the listing which token was revoked', async () => {
          nock(ATLASSIAN_MCP_URL).delete('/tokens/pat_1').reply(204)

          const revoked = await post(
            server,
            '/account/tokens/pat_1/revoke',
            form({ label: 'Claude Code' }),
            authCookie
          )

          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, [])

          const response = await get(
            server,
            '/account/tokens',
            mergeCookies(authCookie, revoked.headers['set-cookie'])
          )

          expect(response.result).toContain('“Claude Code” has been revoked')
        })

        test('returns to the listing without claiming success when the token was already gone', async () => {
          nock(ATLASSIAN_MCP_URL).delete('/tokens/pat_1').reply(404, { detail: 'not found' })

          const revoked = await post(
            server,
            '/account/tokens/pat_1/revoke',
            form({ label: 'Claude Code' }),
            authCookie
          )

          mockAtlassianLinked()
          nock(ATLASSIAN_MCP_URL).get('/tokens').reply(200, [])

          const response = await get(
            server,
            '/account/tokens',
            mergeCookies(authCookie, revoked.headers['set-cookie'])
          )

          expect(revoked.statusCode).toBe(302)
          expect(response.result).not.toContain('has been revoked')
        })
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

    test.each([
      ['/account/tokens'],
      ['/account/tokens/new'],
      ['/account/tokens/created'],
      ['/account/tokens/pat_1/revoke']
    ])('redirects %s to sign in', async (url) => {
      const response = await get(server, url)

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/')
    })
  })
})
