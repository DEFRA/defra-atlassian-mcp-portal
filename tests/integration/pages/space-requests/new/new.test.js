import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { createdSpaceRequest, spaceRequestConflict } from '../../../../fixtures/atlassian-mcp.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { get, post } from '../../../../helpers/server.js'
import { form } from '../../../../helpers/forms.js'

const { createServer } = await import('../../../../../src/server/server.js')

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

const VALID_REASON = 'Need this space to run a team retrospective'

const validForm = (overrides = {}) => form({
  spaceKey: 'FARM',
  products: ['jira', 'confluence'],
  iao: 'jane.smith@defra.gov.uk',
  reason: VALID_REASON,
  ...overrides
})

function mockLinkingStatus (linked) {
  nock(ATLASSIAN_MCP_URL).get('/linking/status').reply(200, { linked })
}

function mockApprovalSubmission (status, body = {}) {
  nock(ATLASSIAN_MCP_URL).post('/approvals/spaces').reply(status, body)
}

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

  describe('when Atlassian is not connected', () => {
    beforeEach(() => {
      mockLinkingStatus(false)
    })

    test('GET /space-requests/new redirects to the linking page', async () => {
      const { statusCode, headers } = await get(server, '/space-requests/new', cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/account/atlassian-linking')
    })

    test('POST /space-requests/new redirects to the linking page', async () => {
      const { statusCode, headers } = await post(server, '/space-requests/new', validForm(), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/account/atlassian-linking')
    })

    test('the linking page says what the user was trying to do', async () => {
      const postRes = await post(server, '/space-requests/new', validForm(), cookie)

      const sessionCookie = mergeCookies(cookie, postRes.headers['set-cookie'])

      // The gate page re-checks the status when it renders, so it needs an
      // interceptor of its own beyond the one the POST above consumed.
      mockLinkingStatus(false)

      const { statusCode, payload } = await get(server, '/account/atlassian-linking', sessionCookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('You need to connect your Atlassian account to request a space.')
      expect(payload).toContain('href="/account/atlassian-linking"')
    })
  })

  describe('when Atlassian is connected', () => {
    beforeEach(() => {
      mockLinkingStatus(true)
    })

    test('GET /space-requests/new renders the form', async () => {
      const { statusCode, payload } = await get(server, '/space-requests/new', cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Space key')
      expect(payload).toContain('Which products do you need access to?')
      expect(payload).toContain('Information Asset Owner')
      expect(payload).toContain('Reason for requesting this space')
      expect(payload).toContain('name="spaceKey"')
      expect(payload).toContain('name="products"')
      expect(payload).toContain('name="iao"')
      expect(payload).toContain('name="reason"')
    })

    test('GET /space-requests/new says this is governed access for the MCP server', async () => {
      const { payload } = await get(server, '/space-requests/new', cookie)

      expect(payload).toContain('Ask for governed access to a space')
      expect(payload).toContain('so the MCP server can read it on your behalf')
    })

    test('GET /space-requests/new offers a checkbox per product', async () => {
      const { payload } = await get(server, '/space-requests/new', cookie)

      expect(payload).toContain('value="jira"')
      expect(payload).toContain('value="confluence"')
      expect(payload).toContain('Jira')
      expect(payload).toContain('Confluence')
    })

    test('POST /space-requests/new shows an error for the space key when empty', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', validForm({ spaceKey: '' }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Enter a space key')
    })

    test('POST /space-requests/new shows an error when no product is selected', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', form({
        spaceKey: 'FARM',
        iao: 'jane.smith@defra.gov.uk',
        reason: VALID_REASON
      }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Select which products you need access to')
    })

    test('POST /space-requests/new accepts a single product', async () => {
      mockApprovalSubmission(statusCodes.HTTP_STATUS_CREATED, createdSpaceRequest())

      const { statusCode } = await post(server, '/space-requests/new', validForm({ products: ['jira'] }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    })

    test('POST /space-requests/new sends only the products that were ticked', async () => {
      let sent

      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/spaces', (body) => {
          sent = body.products
          return true
        })
        .reply(statusCodes.HTTP_STATUS_CREATED, createdSpaceRequest())

      await post(server, '/space-requests/new', validForm({ products: ['confluence'] }), cookie)

      expect(sent).toEqual(['confluence'])
    })

    test('POST /space-requests/new shows an error for IAO when empty', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', validForm({ iao: '' }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Enter an Information Asset Owner email address')
    })

    test('POST /space-requests/new shows all errors and an error summary when every field is empty', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', form({ spaceKey: '', iao: '', reason: '' }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('There is a problem')
      expect(payload).toContain('Enter a space key')
      expect(payload).toContain('Select which products you need access to')
      expect(payload).toContain('Enter an Information Asset Owner email address')
      expect(payload).toContain('Enter a reason for requesting this space')
    })

    test('POST /space-requests/new shows an error when IAO is not a valid email address', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', validForm({ iao: 'not-an-email' }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Enter a valid email address for the Information Asset Owner')
    })

    test('POST /space-requests/new shows an error when IAO is not a defra.gov.uk address', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', validForm({ iao: 'jane@example.com' }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Information Asset Owner must be a defra.gov.uk email address')
    })

    test('POST /space-requests/new shows an error for reason when empty', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', validForm({ reason: '' }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Enter a reason for requesting this space')
    })

    test('POST /space-requests/new shows an error when reason is shorter than 10 characters', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', validForm({ reason: 'too short' }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Reason must be at least 10 characters')
    })

    test('POST /space-requests/new shows an error when reason is longer than 255 characters', async () => {
      const { statusCode, payload } = await post(server, '/space-requests/new', validForm({ reason: 'a'.repeat(256) }), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Reason must be at most 255 characters')
    })

    test('POST /space-requests/new re-populates valid field values on failure', async () => {
      const { payload } = await post(server, '/space-requests/new', validForm({ iao: '' }), cookie)

      expect(payload).toContain('value="FARM"')
      expect(payload).toContain(VALID_REASON)
    })

    test('POST /space-requests/new re-ticks the products that were selected on failure', async () => {
      const { payload } = await post(server, '/space-requests/new', validForm({ iao: '', products: ['confluence'] }), cookie)

      expect(payload).toMatch(/value="confluence"[^>]*checked/)
      expect(payload).not.toMatch(/value="jira"[^>]*checked/)
    })

    test('POST /space-requests/new redirects to confirmation when the API accepts the request', async () => {
      mockApprovalSubmission(statusCodes.HTTP_STATUS_CREATED, createdSpaceRequest())

      const { statusCode, headers } = await post(server, '/space-requests/new', validForm(), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/space-requests/new/confirmation')
    })

    test('POST /space-requests/new shows an error against the space key when a request already exists', async () => {
      mockApprovalSubmission(statusCodes.HTTP_STATUS_CONFLICT, spaceRequestConflict())

      const { statusCode, payload } = await post(server, '/space-requests/new', validForm(), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      expect(payload).toContain('A request for this space already exists')
      expect(payload).toContain('value="FARM"')
    })

    test('POST /space-requests/new renders the generic error page when the API responds with an unexpected status', async () => {
      mockApprovalSubmission(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, { message: 'boom' })

      const { statusCode } = await post(server, '/space-requests/new', validForm(), cookie)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)
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

  test('GET /space-requests/new redirects to sign in', async () => {
    const { statusCode, headers } = await get(server, '/space-requests/new')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(headers).toHaveProperty('location')
    expect(headers.location).toBe('/')
  })

  test('POST /space-requests/new redirects to sign in', async () => {
    const { statusCode, headers } = await post(server, '/space-requests/new', validForm())

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(headers).toHaveProperty('location')
    expect(headers.location).toBe('/')
  })
})
