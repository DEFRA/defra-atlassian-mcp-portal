import { constants as statusCodes } from 'http2'

import nock from 'nock'

import {
  createdSpaceRequest,
  spaceRequestConflict,
  accessRequest,
  accessRequestList
} from '../../../fixtures/atlassian-mcp.js'

import {
  submitSpaceRequest,
  getSpaceRequest,
  listAccessRequests,
  decideAccessRequest
} from '../../../../src/infra/atlassian/approvals.js'

const ATLASSIAN_MCP_URL = 'http://localhost:8086'

const approvalRequest = {
  spaceKey: 'FARM',
  iao: 'Jane Smith',
  reason: 'Need this space for a workshop',
  userId: 'test@example.com',
  products: ['jira', 'confluence']
}

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('approvalsApi', () => {
  describe('submitSpaceRequest', () => {
    test('returns ok:true with data on 201', async () => {
      const responseBody = createdSpaceRequest()

      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/spaces', {
          spaceKey: 'FARM',
          iao: 'Jane Smith',
          reason: 'Need this space for a workshop',
          userId: 'test@example.com',
          products: ['jira', 'confluence']
        })
        .reply(statusCodes.HTTP_STATUS_CREATED, responseBody)

      const result = await submitSpaceRequest(approvalRequest)

      expect(result.ok).toBe(true)
      expect(result.status).toBe(statusCodes.HTTP_STATUS_CREATED)
      expect(result.data).toEqual(responseBody)
    })

    test('sends only the products the requester asked for', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/spaces', (body) => body.products.length === 1 && body.products[0] === 'jira')
        .reply(statusCodes.HTTP_STATUS_CREATED, {})

      const result = await submitSpaceRequest({ ...approvalRequest, products: ['jira'] })

      expect(result.ok).toBe(true)
    })

    test('sends the requester email as the X-User-Id header', async () => {
      nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'test@example.com')
        .post('/approvals/spaces')
        .reply(statusCodes.HTTP_STATUS_CREATED, {})

      const result = await submitSpaceRequest(approvalRequest)

      expect(result.ok).toBe(true)
    })

    test('returns ok:false with status 409 on conflict', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/spaces')
        .reply(statusCodes.HTTP_STATUS_CONFLICT, spaceRequestConflict())

      const result = await submitSpaceRequest(approvalRequest)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      expect(result.data).toBeNull()
    })

    test('throws on network error', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/approvals/spaces')
        .replyWithError('ECONNREFUSED')

      await expect(
        submitSpaceRequest(approvalRequest)
      ).rejects.toThrow()
    })
  })

  describe('getSpaceRequest', () => {
    test('returns ok:true with data on 200', async () => {
      const responseBody = accessRequest()

      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/spaces/FARM')
        .reply(statusCodes.HTTP_STATUS_OK, responseBody)

      const result = await getSpaceRequest('FARM', 'test@example.com')

      expect(result.ok).toBe(true)
      expect(result.status).toBe(statusCodes.HTTP_STATUS_OK)
      expect(result.data).toEqual(responseBody)
    })

    test('returns ok:false with status 404 when not found', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/spaces/FARM')
        .reply(statusCodes.HTTP_STATUS_NOT_FOUND, { message: 'Not found' })

      const result = await getSpaceRequest('FARM', 'test@example.com')

      expect(result.ok).toBe(false)
      expect(result.status).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
      expect(result.data).toBeNull()
    })

    test('throws AtlassianMcpError on unexpected status (500)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/spaces/FARM')
        .reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, { message: 'Internal server error' })

      await expect(getSpaceRequest('FARM', 'test@example.com'))
        .rejects.toMatchObject({
          name: 'AtlassianMcpError',
          statusCode: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR
        })
    })

    test('URL-encodes spaceKey in the path', async () => {
      const responseBody = accessRequest({ spaceKey: 'space/with spaces' })

      nock(ATLASSIAN_MCP_URL)
        .get('/approvals/spaces/space%2Fwith%20spaces')
        .reply(statusCodes.HTTP_STATUS_OK, responseBody)

      const result = await getSpaceRequest('space/with spaces', 'test@example.com')

      expect(result.ok).toBe(true)
      expect(result.data).toEqual(responseBody)
    })
  })

  describe('listAccessRequests', () => {
    test('returns ok:true with the bare array on 200', async () => {
      const responseBody = accessRequestList()

      nock(ATLASSIAN_MCP_URL)
        .get('/admin/access-requests')
        .reply(statusCodes.HTTP_STATUS_OK, responseBody)

      const result = await listAccessRequests('test@example.com')

      expect(result.ok).toBe(true)
      expect(result.data).toEqual(responseBody)
    })

    test('sends the signed-in user as the X-User-Id header', async () => {
      nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'test@example.com')
        .get('/admin/access-requests')
        .reply(statusCodes.HTTP_STATUS_OK, [])

      const result = await listAccessRequests('test@example.com')

      expect(result.ok).toBe(true)
    })

    test('appends a status filter when one is given', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/admin/access-requests')
        .query({ status: 'pending' })
        .reply(statusCodes.HTTP_STATUS_OK, [])

      const result = await listAccessRequests('test@example.com', { status: 'pending' })

      expect(result.ok).toBe(true)
    })

    test('throws AtlassianMcpError on unexpected status (500)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .get('/admin/access-requests')
        .reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, {})

      await expect(listAccessRequests('test@example.com'))
        .rejects.toMatchObject({ name: 'AtlassianMcpError' })
    })
  })

  describe('decideAccessRequest', () => {
    const decision = { product: 'jira', decisionReason: 'No personal data' }

    test('posts the decision to the approve path', async () => {
      const responseBody = accessRequest()

      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve', decision)
        .reply(statusCodes.HTTP_STATUS_OK, responseBody)

      const result = await decideAccessRequest('req-1', 'approve', decision, 'iao@defra.gov.uk')

      expect(result.ok).toBe(true)
      expect(result.data).toEqual(responseBody)
    })

    test('posts the decision to the reject path', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/reject', decision)
        .reply(statusCodes.HTTP_STATUS_OK, {})

      const result = await decideAccessRequest('req-1', 'reject', decision, 'iao@defra.gov.uk')

      expect(result.ok).toBe(true)
    })

    test('sends the reviewer email as the X-User-Id header', async () => {
      nock(ATLASSIAN_MCP_URL)
        .matchHeader('X-User-Id', 'iao@defra.gov.uk')
        .post('/admin/access-requests/req-1/approve')
        .reply(statusCodes.HTTP_STATUS_OK, {})

      const result = await decideAccessRequest('req-1', 'approve', decision, 'iao@defra.gov.uk')

      expect(result.ok).toBe(true)
    })

    test('returns ok:false on 404 rather than throwing', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve')
        .reply(statusCodes.HTTP_STATUS_NOT_FOUND, {})

      const result = await decideAccessRequest('req-1', 'approve', decision, 'iao@defra.gov.uk')

      expect(result.ok).toBe(false)
      expect(result.status).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })

    test('returns ok:false on 409 - that product is already decided', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve')
        .reply(statusCodes.HTTP_STATUS_CONFLICT, {})

      const result = await decideAccessRequest('req-1', 'approve', decision, 'iao@defra.gov.uk')

      expect(result.ok).toBe(false)
      expect(result.status).toBe(statusCodes.HTTP_STATUS_CONFLICT)
    })

    test('URL-encodes requestId in the path', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req%2F1/approve')
        .reply(statusCodes.HTTP_STATUS_OK, {})

      const result = await decideAccessRequest('req/1', 'approve', decision, 'iao@defra.gov.uk')

      expect(result.ok).toBe(true)
    })

    test('throws AtlassianMcpError on unexpected status (500)', async () => {
      nock(ATLASSIAN_MCP_URL)
        .post('/admin/access-requests/req-1/approve')
        .reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, {})

      await expect(decideAccessRequest('req-1', 'approve', decision, 'iao@defra.gov.uk'))
        .rejects.toMatchObject({ name: 'AtlassianMcpError' })
    })
  })
})
