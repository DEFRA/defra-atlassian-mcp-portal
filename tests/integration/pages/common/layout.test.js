import nock from 'nock'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

describe('common layout navigation', () => {
  describe('when authenticated', () => {
    let server
    let authCookie

    beforeAll(async () => {
      server = await createServer()
      await server.initialize()
      nock.disableNetConnect()

      authCookie = await loginAsDevUser(server)
    })

    afterAll(async () => {
      nock.enableNetConnect()
      await server.stop({ timeout: 0 })
    })

    afterEach(() => {
      nock.cleanAll()
    })

    test('shows the nav bar with links to Dashboard, My approvals and Request a board', async () => {
      nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })

      const response = await server.inject({
        method: 'GET',
        url: '/dashboard',
        headers: { Cookie: authCookie }
      })

      expect(response.result).toContain('defra-service-navigation')
      expect(response.result).toContain('href="/dashboard"')
      expect(response.result).toContain('href="/approvals"')
      expect(response.result).toContain('href="/space-requests/new"')
    })

    test.skip('marks the current page with aria-current', async () => {
      nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked: true })

      const response = await server.inject({
        method: 'GET',
        url: '/dashboard',
        headers: { Cookie: authCookie }
      })

      const dashboardLink = response.result.match(/<a class="defra-service-navigation__link" href="\/dashboard"[^>]*>/)[0]
      const approvalsLink = response.result.match(/<a class="defra-service-navigation__link" href="\/approvals"[^>]*>/)[0]

      expect(dashboardLink).toContain('aria-current="page"')
      expect(approvalsLink).not.toContain('aria-current="page"')
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

    test('does not show the nav bar', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(response.result).not.toContain('defra-service-navigation')
    })
  })
})
