import { vi } from 'vitest'

import {
  createdSpaceRequest,
  accessRequest,
  productDecision,
  productNotRequested
} from '../../fixtures/atlassian-mcp.js'
import { products } from '../../../src/constants/products.js'
import { spaceStatuses } from '../../../src/constants/space-statuses.js'

import {
  submitSpaceRequest,
  getSpaceRequest,
  deriveOverallStatus,
  listSpaces,
  listApprovalsForIao,
  getApprovalForIao,
  decideApproval
} from '../../../src/services/space-requests.js'

vi.mock('../../../src/infra/atlassian/approvals.js')

import * as approvalsApi from '../../../src/infra/atlassian/approvals.js'

/**
 * A request whose Jira and Confluence halves sit at the given statuses. A null
 * status means the requester never asked for that product.
 */
function requestFor (overrides, jira, confluence) {
  return accessRequest({
    ...overrides,
    products: {
      [products.JIRA]: jira ? productDecision({ status: jira }) : productNotRequested(),
      [products.CONFLUENCE]: confluence
        ? productDecision({ status: confluence })
        : productNotRequested()
    }
  })
}

describe('spaceRequestsService', () => {
  describe('submitSpaceRequest', () => {
    const approvalRequest = {
      spaceKey: 'FARM',
      iao: 'Jane Smith',
      userId: 'test@example.com',
      products: ['jira', 'confluence']
    }

    test('returns success:true with the response data on 201', async () => {
      const data = createdSpaceRequest()
      approvalsApi.submitSpaceRequest.mockResolvedValue({ ok: true, status: 201, data })

      const result = await submitSpaceRequest(approvalRequest)

      expect(result).toEqual({ success: true, data })
      expect(approvalsApi.submitSpaceRequest).toHaveBeenCalledWith(approvalRequest)
    })

    test('passes the requested products straight through', async () => {
      approvalsApi.submitSpaceRequest.mockResolvedValue({ ok: true, status: 201, data: {} })

      await submitSpaceRequest({ ...approvalRequest, products: ['confluence'] })

      expect(approvalsApi.submitSpaceRequest)
        .toHaveBeenCalledWith(expect.objectContaining({ products: ['confluence'] }))
    })

    test('returns success:false with reason:conflict on 409', async () => {
      approvalsApi.submitSpaceRequest.mockResolvedValue({ ok: false, status: 409, data: null })

      const result = await submitSpaceRequest(approvalRequest)

      expect(result).toEqual({ success: false, reason: 'conflict' })
    })

    test('throws with statusCode on an unexpected status', async () => {
      approvalsApi.submitSpaceRequest.mockResolvedValue({ ok: false, status: 500, data: null })

      await expect(submitSpaceRequest(approvalRequest))
        .rejects.toMatchObject({ message: 'Unexpected status 500 from approvals API', statusCode: 500 })
    })

    test('throws when the infra layer throws', async () => {
      const error = new Error('Network error')
      error.name = 'AtlassianMcpError'
      error.statusCode = 500
      approvalsApi.submitSpaceRequest.mockRejectedValue(error)

      await expect(submitSpaceRequest(approvalRequest))
        .rejects.toThrow('Network error')
    })
  })

  describe('getSpaceRequest', () => {
    test('returns data on 200', async () => {
      const data = accessRequest()
      approvalsApi.getSpaceRequest.mockResolvedValue({ ok: true, status: 200, data })

      const result = await getSpaceRequest('FARM', 'test@example.com')

      expect(result).toEqual(data)
      expect(approvalsApi.getSpaceRequest).toHaveBeenCalledWith('FARM', 'test@example.com')
    })

    test('returns null on 404', async () => {
      approvalsApi.getSpaceRequest.mockResolvedValue({ ok: false, status: 404, data: null })

      const result = await getSpaceRequest('FARM')

      expect(result).toBeNull()
    })

    test('throws when the infra layer throws', async () => {
      const error = new Error('Service unavailable')
      error.name = 'AtlassianMcpError'
      error.statusCode = 503
      approvalsApi.getSpaceRequest.mockRejectedValue(error)

      await expect(getSpaceRequest('FARM')).rejects.toThrow('Service unavailable')
    })

    test('throws with statusCode on an unexpected status', async () => {
      approvalsApi.getSpaceRequest.mockResolvedValue({ ok: false, status: 500, data: null })

      await expect(getSpaceRequest('FARM'))
        .rejects.toMatchObject({ message: 'Unexpected status 500 from approvals API', statusCode: 500 })
    })
  })

  describe('deriveOverallStatus', () => {
    test('is pending while any requested product is still pending', () => {
      const request = requestFor({}, spaceStatuses.APPROVED, spaceStatuses.PENDING)

      expect(deriveOverallStatus(request)).toBe(spaceStatuses.PENDING)
    })

    test('is approved only when every requested product is approved', () => {
      const request = requestFor({}, spaceStatuses.APPROVED, spaceStatuses.APPROVED)

      expect(deriveOverallStatus(request)).toBe(spaceStatuses.APPROVED)
    })

    test('is rejected only when every requested product is rejected', () => {
      const request = requestFor({}, spaceStatuses.REJECTED, spaceStatuses.REJECTED)

      expect(deriveOverallStatus(request)).toBe(spaceStatuses.REJECTED)
    })

    test('is partially approved when one product is approved and the other refused', () => {
      const request = requestFor({}, spaceStatuses.APPROVED, spaceStatuses.REJECTED)

      expect(deriveOverallStatus(request)).toBe(spaceStatuses.PARTIALLY_APPROVED)
    })

    test('ignores a product nobody asked for', () => {
      const request = requestFor({}, null, spaceStatuses.APPROVED)

      expect(deriveOverallStatus(request)).toBe(spaceStatuses.APPROVED)
    })

    test('is not-requested when no product was asked for', () => {
      const request = requestFor({}, null, null)

      expect(deriveOverallStatus(request)).toBe(spaceStatuses.NOT_REQUESTED)
    })

    test('is not-requested rather than a crash when the products map is missing', () => {
      expect(deriveOverallStatus({ id: 'req-1' })).toBe(spaceStatuses.NOT_REQUESTED)
    })
  })

  describe('listSpaces', () => {
    const spaces = [
      requestFor(
        { id: 'req-1', spaceKey: 'FLOOD', reason: 'Flood mapping', userId: 'me@defra.gov.uk' },
        spaceStatuses.APPROVED, spaceStatuses.APPROVED),
      requestFor(
        { id: 'req-2', spaceKey: 'FARM', userId: 'me@defra.gov.uk' },
        spaceStatuses.PENDING, spaceStatuses.PENDING),
      requestFor(
        { id: 'req-3', spaceKey: 'WASTE', userId: 'someone@defra.gov.uk' },
        spaceStatuses.REJECTED, spaceStatuses.REJECTED)
    ]

    beforeEach(() => {
      approvalsApi.listAccessRequests.mockResolvedValue({ ok: true, status: 200, data: spaces })
    })

    test('returns every space when no filters are given', async () => {
      const result = await listSpaces('me@defra.gov.uk')

      expect(result.map((space) => space.spaceKey))
        .toEqual(['FLOOD', 'FARM', 'WASTE'])
    })

    test('keeps only spaces the caller requested when requestedByMe is set', async () => {
      const result = await listSpaces('me@defra.gov.uk', { requestedByMe: true })

      expect(result.map((space) => space.spaceKey)).toEqual(['FLOOD', 'FARM'])
    })

    test('filters on the derived status, not on any field upstream sent', async () => {
      const result = await listSpaces('me@defra.gov.uk', {
        statuses: [spaceStatuses.APPROVED, spaceStatuses.REJECTED]
      })

      expect(result.map((space) => space.spaceKey)).toEqual(['FLOOD', 'WASTE'])
    })

    test('finds a partially approved space by that status', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [requestFor({ spaceKey: 'AIRQ' }, spaceStatuses.APPROVED, spaceStatuses.REJECTED)]
      })

      const result = await listSpaces('me@defra.gov.uk', {
        statuses: [spaceStatuses.PARTIALLY_APPROVED]
      })

      expect(result.map((space) => space.spaceKey)).toEqual(['AIRQ'])
    })

    test('keeps only spaces that asked for one of the requested products', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [
          requestFor({ spaceKey: 'JIRAONLY' }, spaceStatuses.PENDING, null),
          requestFor({ spaceKey: 'CONFONLY' }, null, spaceStatuses.PENDING)
        ]
      })

      const result = await listSpaces('me@defra.gov.uk', { products: [products.JIRA] })

      expect(result.map((space) => space.spaceKey)).toEqual(['JIRAONLY'])
    })

    test('matches the search query against the space key', async () => {
      const result = await listSpaces('me@defra.gov.uk', { q: 'farm' })

      expect(result.map((space) => space.spaceKey)).toEqual(['FARM'])
    })

    test('matches the search query against the space name when one is present', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [accessRequest({ spaceKey: 'OPAQUE', name: 'Air quality roadmap' })]
      })

      const result = await listSpaces('me@defra.gov.uk', { q: 'air quality' })

      expect(result).toHaveLength(1)
    })

    test('combines filters rather than treating them as alternatives', async () => {
      const result = await listSpaces('me@defra.gov.uk', {
        requestedByMe: true,
        statuses: [spaceStatuses.REJECTED]
      })

      expect(result).toEqual([])
    })

    test('throws with statusCode on an unexpected status', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({ ok: false, status: 500, data: null })

      await expect(listSpaces('me@defra.gov.uk'))
        .rejects.toMatchObject({ message: 'Unexpected status 500 from approvals API', statusCode: 500 })
    })
  })

  describe('listApprovalsForIao', () => {
    test('keeps only pending requests that name the caller as IAO', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [
          accessRequest({ id: 'mine', iao: 'me@defra.gov.uk' }),
          accessRequest({ id: 'someone-elses', iao: 'other@defra.gov.uk' })
        ]
      })

      const result = await listApprovalsForIao('me@defra.gov.uk')

      expect(result.map((request) => request.id)).toEqual(['mine'])
    })

    test('matches the IAO email regardless of case', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [accessRequest({ id: 'mine', iao: 'Me@Defra.Gov.UK' })]
      })

      const result = await listApprovalsForIao('me@defra.gov.uk')

      expect(result.map((request) => request.id)).toEqual(['mine'])
    })

    test('drops requests whose every product has already been decided', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [
          requestFor({ id: 'decided', iao: 'me@defra.gov.uk' },
            spaceStatuses.APPROVED, spaceStatuses.REJECTED),
          requestFor({ id: 'waiting', iao: 'me@defra.gov.uk' },
            spaceStatuses.PENDING, spaceStatuses.PENDING)
        ]
      })

      const result = await listApprovalsForIao('me@defra.gov.uk')

      expect(result.map((request) => request.id)).toEqual(['waiting'])
    })

    test('keeps a request that is decided for one product but not the other', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [requestFor({ id: 'half-done', iao: 'me@defra.gov.uk' },
          spaceStatuses.APPROVED, spaceStatuses.PENDING)]
      })

      const result = await listApprovalsForIao('me@defra.gov.uk')

      expect(result.map((request) => request.id)).toEqual(['half-done'])
    })

    test('returns the oldest request first, so the longest wait is dealt with first', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [
          accessRequest({ id: 'newer', iao: 'me@defra.gov.uk', createdAt: '2026-08-27T10:00:00.000Z' }),
          accessRequest({ id: 'older', iao: 'me@defra.gov.uk', createdAt: '2026-08-01T10:00:00.000Z' })
        ]
      })

      const result = await listApprovalsForIao('me@defra.gov.uk')

      expect(result.map((request) => request.id)).toEqual(['older', 'newer'])
    })

    test('throws with statusCode on an unexpected status', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({ ok: false, status: 500, data: null })

      await expect(listApprovalsForIao('me@defra.gov.uk'))
        .rejects.toMatchObject({ message: 'Unexpected status 500 from approvals API', statusCode: 500 })
    })
  })

  describe('getApprovalForIao', () => {
    test('returns the request when it is pending and addressed to the caller', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [accessRequest({ id: 'req-1', iao: 'me@defra.gov.uk' })]
      })

      const result = await getApprovalForIao('req-1', 'me@defra.gov.uk')

      expect(result).toMatchObject({ id: 'req-1' })
    })

    test('returns null for a request addressed to another Information Asset Owner', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [accessRequest({ id: 'req-1', iao: 'other@defra.gov.uk' })]
      })

      const result = await getApprovalForIao('req-1', 'me@defra.gov.uk')

      expect(result).toBeNull()
    })

    test('returns null for a request that has already been decided', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({
        ok: true,
        status: 200,
        data: [requestFor({ id: 'req-1', iao: 'me@defra.gov.uk' },
          spaceStatuses.APPROVED, spaceStatuses.APPROVED)]
      })

      const result = await getApprovalForIao('req-1', 'me@defra.gov.uk')

      expect(result).toBeNull()
    })

    test('returns null for an id the service has never seen', async () => {
      approvalsApi.listAccessRequests.mockResolvedValue({ ok: true, status: 200, data: [] })

      expect(await getApprovalForIao('req-nope', 'me@defra.gov.uk')).toBeNull()
    })
  })

  describe('decideApproval', () => {
    test('returns the decided request on success', async () => {
      const data = requestFor({}, spaceStatuses.APPROVED, spaceStatuses.PENDING)
      approvalsApi.decideAccessRequest.mockResolvedValue({ ok: true, status: 200, data })

      const decision = { product: products.JIRA, decisionReason: 'Yes' }
      const result = await decideApproval('req-1', 'approve', decision, 'me@defra.gov.uk')

      expect(result).toEqual({ success: true, data })
      expect(approvalsApi.decideAccessRequest)
        .toHaveBeenCalledWith('req-1', 'approve', decision, 'me@defra.gov.uk')
    })

    test('passes the product through, so one call decides one product', async () => {
      approvalsApi.decideAccessRequest.mockResolvedValue({ ok: true, status: 200, data: {} })

      await decideApproval('req-1', 'reject', { product: products.CONFLUENCE }, 'me@defra.gov.uk')

      expect(approvalsApi.decideAccessRequest).toHaveBeenCalledWith(
        'req-1', 'reject', { product: products.CONFLUENCE }, 'me@defra.gov.uk')
    })

    test('reports a product decided elsewhere as gone', async () => {
      approvalsApi.decideAccessRequest.mockResolvedValue({ ok: false, status: 409, data: null })

      const result = await decideApproval('req-1', 'approve', {}, 'me@defra.gov.uk')

      expect(result).toEqual({ success: false, reason: 'gone' })
    })

    test('reports a withdrawn request as gone too, since neither is the reviewer\'s to decide', async () => {
      approvalsApi.decideAccessRequest.mockResolvedValue({ ok: false, status: 404, data: null })

      const result = await decideApproval('req-1', 'approve', {}, 'me@defra.gov.uk')

      expect(result).toEqual({ success: false, reason: 'gone' })
    })

    test('throws with statusCode on an unexpected status', async () => {
      approvalsApi.decideAccessRequest.mockResolvedValue({ ok: false, status: 500, data: null })

      await expect(decideApproval('req-1', 'approve', {}, 'me@defra.gov.uk'))
        .rejects.toMatchObject({ message: 'Unexpected status 500 from approvals API', statusCode: 500 })
    })
  })
})
