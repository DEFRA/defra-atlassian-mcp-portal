import { statusCodes } from '../../constants/status-codes.js'
import { atlassianClient } from './client.js'

/**
 * ApprovalRequest - Domain type for space request approvals
 * @typedef {Object} ApprovalRequest
 * @property {string} spaceKey - The key of the space
 * @property {string} iao - The Information Asset Owner
 * @property {string} userId - The ID of the user making the request
 * @property {string} reason - The reason for the request
 * @property {string[]} products - The `products` codes access is wanted for
 */

/**
 * Decision - The body of an approve or reject call
 * @typedef {Object} Decision
 * @property {string} product - The single `products` code this decision covers
 * @property {string} [decisionReason] - Why the Information Asset Owner decided this way
 * @property {string} [dataHandlingFormRef] - Reference of the supporting data handling form
 * @property {string} [riskAssessmentRef] - Reference of the supporting risk assessment
 */

/**
 * Submit a space approval request
 * @param {ApprovalRequest} approvalRequest - The approval request
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {AtlassianMcpError} - When response is not ok and not a 409 conflict
 */
async function submitSpaceRequest (approvalRequest) {
  const body = {
    spaceKey: approvalRequest.spaceKey,
    iao: approvalRequest.iao,
    reason: approvalRequest.reason,
    userId: approvalRequest.userId,
    products: approvalRequest.products
  }

  return atlassianClient.request('/approvals/spaces', {
    method: 'POST',
    body,
    userId: approvalRequest.userId,
    expected: [statusCodes.HTTP_STATUS_CONFLICT]
  })
}

/**
 * Get a space approval request
 * @param {string} spaceKey - The key of the space
 * @param {string} userId - The signed-in user
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {AtlassianMcpError} - When response is not ok and not a 404 not found
 */
async function getSpaceRequest (spaceKey, userId) {
  return atlassianClient.request(`/approvals/spaces/${encodeURIComponent(spaceKey)}`, {
    method: 'GET',
    userId,
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
  })
}

/**
 * List the access requests upstream holds.
 *
 * Upstream returns every pending request, unfiltered and with no envelope -
 * there is no `iao` parameter to push the "requests addressed to me" question
 * down to, which is why `services/space-requests.js` filters the result itself.
 *
 * @param {string} userId - The signed-in user, sent as the `X-User-Id` header
 * @param {{status?: string}} [filters] - Optional upstream-side status filter
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {AtlassianMcpError} - When the response is not ok
 */
async function listAccessRequests (userId, filters = {}) {
  const query = filters.status
    ? `?${new URLSearchParams({ status: filters.status })}`
    : ''

  return atlassianClient.request(`/admin/access-requests${query}`, {
    method: 'GET',
    userId
  })
}

/**
 * Record an Information Asset Owner's decision on one product of one request.
 *
 * The decision is per product, not per request: `decision.product` says whether
 * this approves the space for Jira or for Confluence, and upstream leaves the
 * other product exactly as it was. Approving a space for both means two calls.
 *
 * 404 and 409 are expected rather than exceptional. 404 means the request was
 * withdrawn; 409 means that product has already been decided, most likely in
 * another tab. Both are outcomes the caller must be able to explain, not
 * failures.
 *
 * @param {string} requestId - The request to decide
 * @param {'approve'|'reject'} action - Which decision to record
 * @param {Decision} decision - The decision body
 * @param {string} reviewerId - The deciding user, sent as the `X-User-Id` header
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {AtlassianMcpError} - When the response is not ok and not 404 or 409
 */
async function decideAccessRequest (requestId, action, decision, reviewerId) {
  return atlassianClient.request(
    `/admin/access-requests/${encodeURIComponent(requestId)}/${action}`,
    {
      method: 'POST',
      body: decision,
      userId: reviewerId,
      expected: [
        statusCodes.HTTP_STATUS_NOT_FOUND,
        statusCodes.HTTP_STATUS_CONFLICT
      ]
    }
  )
}

export {
  submitSpaceRequest,
  getSpaceRequest,
  listAccessRequests,
  decideAccessRequest
}
