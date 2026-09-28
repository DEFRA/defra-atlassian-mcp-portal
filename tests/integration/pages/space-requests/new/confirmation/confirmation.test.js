import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { createdSpaceRequest } from '../../../../../fixtures/atlassian-mcp.js'
import { mergeCookies } from '../../../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../../../helpers/login.js'
import { form } from '../../../../../helpers/forms.js'

const { createServer } = await import('../../../../../../src/server/server.js')

const ATLASSIAN_MCP_URL = 'http://localhost:8086'
const VALID_REASON = 'Need this space to run a team retrospective'

function mockLinkingStatus (linked) {
  nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked })
}

/**
 * Submits the form and follows the redirect, returning the confirmation page.
 * The two are inseparable: the confirmation reads a one-shot session flash the
 * POST writes, so there is no way to reach it other than by going through the
 * form first.
 */
async function submitAndConfirm (server, cookie, products) {
  mockLinkingStatus(true)
  nock(ATLASSIAN_MCP_URL).post('/approvals/spaces').reply(201, createdSpaceRequest())

  const postRes = await server.inject({
    method: 'POST',
    url: '/space-requests/new',
    headers: { Cookie: cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: form({ spaceKey: 'FARM', products, iao: 'jane.smith@defra.gov.uk', reason: VALID_REASON })
  })

  expect(postRes.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  expect(postRes.headers.location).toBe('/space-requests/new/confirmation')

  return server.inject({
    method: 'GET',
    url: '/space-requests/new/confirmation',
    headers: { Cookie: mergeCookies(cookie, postRes.headers['set-cookie']) }
  })
}

describe('confirmationPage', () => {
  describe('when authenticated', () => {
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

    describe('GET /space-requests/new/confirmation', () => {
      test('shows pending request details after successful submission', async () => {
        const getRes = await submitAndConfirm(server, cookie, ['jira', 'confluence'])

        expect(getRes.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(getRes.payload).toContain('Space request submitted')
        expect(getRes.payload).toContain('FARM')
        expect(getRes.payload).toContain('jane.smith@defra.gov.uk')
      })

      test('shows a status row per product, both pending', async () => {
        const getRes = await submitAndConfirm(server, cookie, ['jira', 'confluence'])

        expect(getRes.payload).toContain('Products requested')
        expect(getRes.payload).toContain('Jira')
        expect(getRes.payload).toContain('Confluence')
        // One tag per product row. The panel's own wording is lower-cased by
        // the template, so it does not count towards this.
        expect(getRes.payload.match(/Pending/g)).toHaveLength(2)
      })

      test('lists only the product that was asked for', async () => {
        const getRes = await submitAndConfirm(server, cookie, ['jira'])

        expect(getRes.payload).toContain('Jira')
        expect(getRes.payload).not.toContain('Confluence')
      })

      test('redirects back to the form when there is nothing to confirm', async () => {
        const { statusCode, headers } = await server.inject({
          method: 'GET',
          url: '/space-requests/new/confirmation',
          headers: { Cookie: cookie }
        })

        expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(headers.location).toBe('/space-requests/new')
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

    test('GET /space-requests/new/confirmation redirects to sign in', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/space-requests/new/confirmation'
      })

      expect(statusCode).toBe(302)
      expect(headers).toHaveProperty('location')
      expect(headers.location).toBe('/')
    })
  })
})
