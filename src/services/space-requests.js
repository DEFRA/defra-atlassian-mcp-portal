import { orderedProducts } from '../constants/products.js'
import { spaceStatuses } from '../constants/space-statuses.js'
import { statusCodes } from '../constants/status-codes.js'
import * as approvalsApi from '../infra/atlassian/approvals.js'

/**
 * Submit a space approval request
 * @param {Object} approvalRequest - The approval request
 * @returns {Promise<Object>} The approval request response data or {success:false, reason:'conflict'} for 409
 * @throws {AtlassianMcpError} - If submission fails with unexpected status
 */
async function submitSpaceRequest (approvalRequest) {
  const res = await approvalsApi.submitSpaceRequest(approvalRequest)

  if (res.ok) {
    return {
      success: true,
      data: res.data
    }
  }

  if (res.status === statusCodes.HTTP_STATUS_CONFLICT) {
    return {
      success: false,
      reason: 'conflict'
    }
  }

  throw _unexpectedStatus(res.status)
}

/**
 * Get the space approval request for a single space.
 *
 * @param {string} spaceKey - The key of the space
 * @param {string} userId - The signed-in user
 * @returns {Promise<Object|null>} The approval request data, or null if the
 *   space has never been requested
 * @throws {AtlassianMcpError} - If an unexpected error occurs
 */
async function getSpaceRequest (spaceKey, userId) {
  const res = await approvalsApi.getSpaceRequest(spaceKey, userId)

  if (res.ok) {
    return res.data
  }

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  throw _unexpectedStatus(res.status)
}

/**
 * Reduce a request's per-product decisions to the one status a listing row or a
 * status tag can show.
 *
 * Approval is granted per product, so a request genuinely has no single status
 * upstream - `FARM` can be live in Jira while its Confluence half is still
 * waiting. Rather than let each caller invent its own answer, every one of them
 * asks this. Products the requester never asked for are ignored: a Jira-only
 * request is approved once Jira is approved, not held open by a Confluence
 * decision nobody wanted.
 *
 * The derivation lives here, not upstream, so the portal has one definition of
 * what a status tag means even if upstream sends a `status` field of its own.
 *
 * @param {Object} request - A space request carrying a `products` map
 * @returns {string} One of `spaceStatuses`
 */
function deriveOverallStatus (request) {
  const requested = _requestedProducts(request)

  if (!requested.length) {
    return spaceStatuses.NOT_REQUESTED
  }

  const statuses = requested.map((product) => product.status)

  if (statuses.includes(spaceStatuses.PENDING)) {
    return spaceStatuses.PENDING
  }

  if (statuses.every((status) => status === spaceStatuses.APPROVED)) {
    return spaceStatuses.APPROVED
  }

  if (statuses.every((status) => status === spaceStatuses.REJECTED)) {
    return spaceStatuses.REJECTED
  }

  return spaceStatuses.PARTIALLY_APPROVED
}

/**
 * List governed spaces, newest request first.
 *
 * A space *is* its access request here: approval is a service-wide fact about
 * the space rather than a per-user grant, so the set of spaces the service
 * knows about is exactly the set that has been through - or is going through
 * - the request/review workflow.
 *
 * Filtering happens here rather than in the controller so the spaces page and
 * any future caller share one definition of what a filter means.
 *
 * @param {string} userId - The signed-in user
 * @param {{q?: string, statuses?: string[], products?: string[], requestedByMe?: boolean}} [filters]
 * @returns {Promise<Object[]>} Matching spaces
 * @throws {AtlassianMcpError} - If an unexpected error occurs
 */
async function listSpaces (userId, filters = {}) {
  const res = await approvalsApi.listAccessRequests(userId)

  if (!res.ok) {
    throw _unexpectedStatus(res.status)
  }

  const query = filters.q?.trim().toLowerCase()

  return (res.data ?? []).filter((space) => {
    if (filters.requestedByMe && space.userId !== userId) {
      return false
    }

    if (filters.statuses?.length && !filters.statuses.includes(deriveOverallStatus(space))) {
      return false
    }

    if (filters.products?.length && !_asksForAnyProduct(space, filters.products)) {
      return false
    }

    if (query && !_matchesQuery(space, query)) {
      return false
    }

    return true
  })
}

/**
 * List the pending requests awaiting the signed-in user's decision as
 * Information Asset Owner.
 *
 * The IAO filter is applied here because upstream
 * `GET /admin/access-requests` returns every pending request unfiltered -
 * there is no `iao` query parameter to push this down to.
 *
 * A request is waiting on the reviewer while *any* product they asked for is
 * still pending. One already approved for Jira but not yet decided for
 * Confluence is still their work.
 *
 * @param {string} userId - The signed-in user's email, matched against `iao`
 * @returns {Promise<Object[]>} Requests this user must review, oldest first
 * @throws {AtlassianMcpError} - If an unexpected error occurs
 */
async function listApprovalsForIao (userId) {
  const res = await approvalsApi.listAccessRequests(userId, { status: spaceStatuses.PENDING })

  if (!res.ok) {
    throw _unexpectedStatus(res.status)
  }

  return (res.data ?? [])
    .filter((request) => deriveOverallStatus(request) === spaceStatuses.PENDING)
    .filter((request) => _sameUser(request.iao, userId))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

/**
 * Fetch one pending request that the signed-in user is entitled to review.
 *
 * Reads the list and picks the request out of it, because upstream has no
 * `GET /admin/access-requests/{id}` - the list endpoint is the only way in.
 * The IAO check happens here rather than in the controller so that no caller
 * can reach a request addressed to somebody else by knowing its id.
 *
 * @param {string} requestId
 * @param {string} userId - The signed-in user's email, matched against `iao`
 * @returns {Promise<Object|null>} The request, or null if it is absent,
 *   already decided, or addressed to another Information Asset Owner
 * @throws {AtlassianMcpError} - If an unexpected error occurs
 */
async function getApprovalForIao (requestId, userId) {
  const approvals = await listApprovalsForIao(userId)

  return approvals.find((request) => request.id === requestId) ?? null
}

/**
 * Record an Information Asset Owner's decision on one product of one request.
 *
 * `decision.product` is what makes the approval granular: it decides the space
 * for Jira or for Confluence and leaves the other product untouched, so a
 * reviewer who approves Jira and refuses Confluence calls this twice.
 *
 * 404 and 409 collapse to the same `gone` outcome on purpose. Withdrawn and
 * already-decided are different upstream, but from the reviewer's side they are
 * one thing - the decision is no longer theirs to make - and telling the two
 * apart would leak whether a request they can no longer see ever existed.
 *
 * @param {string} requestId - The request to decide
 * @param {'approve'|'reject'} action - Which decision to record
 * @param {Object} decision - `product`, plus any decision reason and references
 * @param {string} userId - The deciding user
 * @returns {Promise<{success: boolean, data?: Object, reason?: string}>}
 * @throws {AtlassianMcpError} - If the decision fails with an unexpected status
 */
async function decideApproval (requestId, action, decision, userId) {
  const res = await approvalsApi.decideAccessRequest(requestId, action, decision, userId)

  if (res.ok) {
    return {
      success: true,
      data: res.data
    }
  }

  if (
    res.status === statusCodes.HTTP_STATUS_NOT_FOUND ||
    res.status === statusCodes.HTTP_STATUS_CONFLICT
  ) {
    return {
      success: false,
      reason: 'gone'
    }
  }

  throw _unexpectedStatus(res.status)
}

/**
 * @private
 * The per-product entries the requester actually asked for, in display order.
 *
 * Tolerates a request with no `products` map at all - an older record, or one
 * upstream sent before this field existed - by reporting nothing as requested
 * rather than throwing inside a listing.
 */
function _requestedProducts (request) {
  const products = request?.products ?? {}

  return orderedProducts
    .map((code) => products[code])
    .filter((product) => product?.requested)
}

/**
 * @private
 */
function _asksForAnyProduct (space, wanted) {
  return wanted.some((code) => space?.products?.[code]?.requested)
}

/**
 * @private
 * Space key and name are both searchable - a user looking for a space is as
 * likely to paste a key out of an Atlassian URL as to type part of its name.
 */
function _matchesQuery (space, query) {
  return [space.spaceKey, space.name]
    .filter(Boolean)
    .some((field) => field.toLowerCase().includes(query))
}

/**
 * @private
 * Email addresses are case-insensitive, and an IAO recorded as
 * `First.Last@defra.gov.uk` must still match a session email of
 * `first.last@defra.gov.uk`.
 */
function _sameUser (a, b) {
  return Boolean(a) && Boolean(b) && a.toLowerCase() === b.toLowerCase()
}

/**
 * @private
 */
function _unexpectedStatus (status) {
  const error = new Error(`Unexpected status ${status} from approvals API`)
  error.statusCode = status

  return error
}

export {
  submitSpaceRequest,
  getSpaceRequest,
  deriveOverallStatus,
  listSpaces,
  listApprovalsForIao,
  getApprovalForIao,
  decideApproval
}
