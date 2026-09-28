import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

describe('loginController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('When logged in as a dev user', () => {
    test('redirects to the dashboard when already logged in', async () => {
      const cookie = await loginAsDevUser(server)

      const { headers, statusCode } = await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/dashboard')
    })
  })

  describe('When not logged in', () => {
    test('returns 200 and renders the sign-in page', async () => {
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Sign in to the Atlassian MCP Portal')
    })

    test('renders the same nonce in the inline script as the CSP header names for script-src', async () => {
      const { headers, payload } = await server.inject({
        method: 'GET',
        url: '/'
      })

      const [, headerNonce] = headers['content-security-policy'].match(
        /script-src[^;]*'nonce-([a-f0-9]+)'/
      )
      const [, renderedNonce] = payload.match(/<script nonce="([^"]+)">/)

      expect(renderedNonce).toBe(headerNonce)
    })
  })

  describe('handleLoginCallback', () => {
    beforeAll(() => {
      nock.disableNetConnect()
    })

    afterAll(() => {
      nock.enableNetConnect()
    })

    afterEach(() => {
      nock.cleanAll()
    })

    test('establishes a session and redirects to the dashboard when using the local provider', async () => {
      const callback = await server.inject({
        method: 'GET',
        url: '/login/callback'
      })

      expect(callback.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(callback.headers.location).toBe('/dashboard')

      const cookie = (callback.headers['set-cookie'] ?? [])
        .map((c) => c.split(';')[0])
        .join('; ')
      expect(cookie).not.toBe('')

      nock(ATLASSIAN_MCP_URL)
        .get('/linking/status')
        .reply(200, { linked: true })

      // Confirms the dev-session profile was actually stored against the
      // session (not just that a cookie was set) - it flows through to the
      // shared layout's header on the next request.
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/account/atlassian-linking',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Dev User')
    })
  })

  describe('logout', () => {
    test('ends the session and redirects to the sign-in page when authenticated', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/logout',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')

      // Confirms the cached session was actually dropped, not just the
      // cookie cleared client-side - reusing the original cookie should now
      // be treated as unauthenticated.
      const reuse = await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie }
      })

      expect(reuse.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })

    test('redirects to the sign-in page without requiring a session when unauthenticated', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/logout'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
