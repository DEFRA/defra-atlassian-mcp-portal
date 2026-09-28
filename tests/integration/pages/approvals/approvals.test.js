import nock from 'nock'

import {
  createdBoardRequest,
  boardRequestConflict,
  accessRequest,
  accessRequestList
} from '../../../fixtures/atlassian-mcp.js'

import {
  submitBoardRequest,
  getBoardRequest,
  listAccessRequests,
  decideAccessRequest
} from '../../../../src/infra/atlassian/approvals.js'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

const approvalRequest = (overrides = {}) => ({
  boardId: 'board-abc',
  iao: 'Jane Smith',
  reason: 'Need this board for a workshop',
  userId: 'test@example.com',
  ...overrides
})

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe.skip('approvalsApi', () => {
  describe('submitBoardRequest', () => {
    test('returns ok:true with data on 201', async () => {
      const responseBody = createdBoardRequest()

      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/boards', { boardId: 'board-abc', iao: 'Jane Smith', reason: 'Need this board for a workshop', userId: 'test@example.com' })
        .reply(201, responseBody)

      const result = await submitBoardRequest(approvalRequest())

      expect(result.ok).toBe(true)
      expect(result.status).toBe(201)
      expect(result.data).toEqual(responseBody)
    })

    test('sends the requester email as the X-User-Id header', async () => {
      const scope = nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'test@example.com')
        .post('/approvals/boards')
        .reply(201, createdBoardRequest())

      await submitBoardRequest(approvalRequest())

      expect(scope.isDone()).toBe(true)
    })

    test('returns ok:false with status 409 on conflict', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/boards')
        .reply(409, boardRequestConflict())

      const result = await submitBoardRequest(approvalRequest())

      expect(result.ok).toBe(false)
      expect(result.status).toBe(409)
      expect(result.data).toBeNull()
    })

    test('throws on network error', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/boards')
        .replyWithError('ECONNREFUSED')

      await expect(
        submitBoardRequest(approvalRequest())
      ).rejects.toThrow()
    })
  })

  describe('getBoardRequest', () => {
    test('returns ok:true with data on 200', async () => {
      const responseBody = accessRequest()

      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/boards/board-abc')
        .reply(200, responseBody)

      const result = await getBoardRequest('board-abc', 'test@example.com')

      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toEqual(responseBody)
    })

    test('sends the caller email as the X-User-Id header', async () => {
      const scope = nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'test@example.com')
        .get('/approvals/boards/board-abc')
        .reply(200, accessRequest())

      await getBoardRequest('board-abc', 'test@example.com')

      expect(scope.isDone()).toBe(true)
    })

    test('returns ok:false with status 404 when not found', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/boards/board-abc')
        .reply(404, { message: 'Not found' })

      const result = await getBoardRequest('board-abc', 'test@example.com')

      expect(result.ok).toBe(false)
      expect(result.status).toBe(404)
      expect(result.data).toBeNull()
    })

    test('throws AtlassianMcpError on unexpected status (500)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/boards/board-abc')
        .reply(500, { message: 'Internal server error' })

      await expect(getBoardRequest('board-abc', 'test@example.com'))
        .rejects.toMatchObject({
          name: 'AtlassianMcpError',
          statusCode: 500
        })
    })

    test('URL-encodes boardId in the path', async () => {
      const responseBody = accessRequest({ boardId: 'board/with spaces' })

      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/boards/board%2Fwith%20spaces')
        .reply(200, responseBody)

      const result = await getBoardRequest('board/with spaces', 'test@example.com')

      expect(result.ok).toBe(true)
      expect(result.data).toEqual(responseBody)
    })
  })

  describe('listAccessRequests', () => {
    test('returns ok:true with the request list on 200', async () => {
      const responseBody = accessRequestList([
        accessRequest({ id: 'req-1' }),
        accessRequest({ id: 'req-2', boardId: 'board-def' })
      ])

      nock(ATLASSIAN_MCP_URL)
        .get('/admin/access-requests')
        .reply(200, responseBody)

      const result = await listAccessRequests('test@example.com')

      expect(result.ok).toBe(true)
      expect(result.data).toEqual(responseBody)
    })

    test('sends the caller email as the X-User-Id header', async () => {
      const scope = nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'test@example.com')
        .get('/admin/access-requests')
        .reply(200, accessRequestList())

      await listAccessRequests('test@example.com')

      expect(scope.isDone()).toBe(true)
    })

    test('does not send the status option upstream, which takes no filters', async () => {
      const unfiltered = nock(ATLASSIAN_MCP_URL)
        .get('/admin/access-requests')
        .reply(200, accessRequestList())

      const filtered = nock(ATLASSIAN_MCP_URL)
        .get('/admin/access-requests')
        .query({ status: 'pending' })
        .reply(200, accessRequestList())

      await listAccessRequests('test@example.com', { status: 'pending' })

      expect(unfiltered.isDone()).toBe(true)
      expect(filtered.isDone()).toBe(false)
    })

    test('throws AtlassianMcpError on unexpected status (500)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/admin/access-requests')
        .reply(500, { message: 'Internal server error' })

      await expect(listAccessRequests('test@example.com'))
        .rejects.toMatchObject({
          name: 'AtlassianMcpError',
          statusCode: 500
        })
    })
  })

  describe('decideAccessRequest', () => {
    test('posts the approval body to the approve endpoint', async () => {
      const body = {
        decisionReason: 'No personal data on the board',
        dataHandlingFormRef: 'form.pdf',
        riskAssessmentRef: 'RA-2026-018'
      }

      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve', body)
        .reply(200, accessRequest({ status: 'approved' }))

      const result = await decideAccessRequest('req-1', 'approve', body, 'iao@defra.gov.uk')

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({ status: 'approved' })
    })

    test('posts to the reject endpoint, whose body carries only a reason', async () => {
      const scope = nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/reject', { decisionReason: 'Unredacted contact details' })
        .reply(200, accessRequest({ status: 'rejected' }))

      await decideAccessRequest('req-1', 'reject', { decisionReason: 'Unredacted contact details' }, 'iao@defra.gov.uk')

      expect(scope.isDone()).toBe(true)
    })

    test('sends the reviewer email as the X-User-Id header', async () => {
      const scope = nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'iao@defra.gov.uk')
        .post('/admin/access-requests/req-1/reject')
        .reply(200, accessRequest())

      await decideAccessRequest('req-1', 'reject', { decisionReason: 'No' }, 'iao@defra.gov.uk')

      expect(scope.isDone()).toBe(true)
    })

    test('URL-encodes the request id in the path', async () => {
      const scope = nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req%2F1/reject')
        .reply(200, accessRequest())

      await decideAccessRequest('req/1', 'reject', { decisionReason: 'No' }, 'iao@defra.gov.uk')

      expect(scope.isDone()).toBe(true)
    })

    test('reports a request decided by somebody else as a 409 rather than throwing', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve')
        .reply(409, { detail: 'Access request req-1 already approved' })

      const result = await decideAccessRequest('req-1', 'approve', {}, 'iao@defra.gov.uk')

      expect(result).toEqual({ ok: false, status: 409, data: null })
    })

    test('reports a withdrawn request as a 404 rather than throwing', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve')
        .reply(404, { detail: 'No access request req-1' })

      const result = await decideAccessRequest('req-1', 'approve', {}, 'iao@defra.gov.uk')

      expect(result).toEqual({ ok: false, status: 404, data: null })
    })

    test('throws AtlassianMcpError on unexpected status (500)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve')
        .reply(500, { message: 'Internal server error' })

      await expect(decideAccessRequest('req-1', 'approve', {}, 'iao@defra.gov.uk'))
        .rejects.toMatchObject({ name: 'AtlassianMcpError', statusCode: 500 })
    })
  })
})

describe.skip('approvalsController', () => {
  describe('when authenticated', () => {
    let server
    let authCookie

    beforeAll(async () => {
      server = await createServer()
      await server.initialize()
      // No interceptor is registered for this test - if the route called the
      // Atlassian API (i.e. `requiresAtlassianLink` was mistakenly added) this would
      // fail with an unmocked-request error rather than silently passing.
      nock.disableNetConnect()

      authCookie = await loginAsDevUser(server)
    })

    afterAll(async () => {
      nock.enableNetConnect()
      await server.stop({ timeout: 0 })
    })

    test('GET /approvals renders the coming-soon page without requiring a Atlassian link', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/approvals',
        headers: { Cookie: authCookie }
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toContain('My approvals')
      expect(response.result).toContain('This feature is coming soon.')
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

    test('GET /approvals redirects to sign in', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/approvals'
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/')
    })
  })
})
