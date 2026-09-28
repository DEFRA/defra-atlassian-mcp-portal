import { products } from '../../src/constants/products.js'
import { spaceStatuses } from '../../src/constants/space-statuses.js'

/**
 * One product's entry in an access request's `products` map.
 *
 * Approval is granted per product, so this is the record that actually carries
 * a decision - `reviewerId`, `decisionReason` and `decidedAt` live here rather
 * than on the request, because a space approved for Jira and refused for
 * Confluence has two of each.
 *
 * @param {Object} [overrides] - Fields to override on the entry
 * @returns {Object}
 */
function productDecision (overrides = {}) {
  return {
    requested: true,
    status: spaceStatuses.PENDING,
    reviewerId: null,
    decisionReason: null,
    decidedAt: null,
    ...overrides
  }
}

/**
 * A product the requester did not ask for.
 *
 * Distinct from a pending one, and the distinction matters: a Confluence-only
 * request must not be held open waiting on a Jira decision nobody wanted.
 *
 * @returns {Object}
 */
function productNotRequested () {
  return {
    requested: false,
    status: spaceStatuses.NOT_REQUESTED,
    reviewerId: null,
    decisionReason: null,
    decidedAt: null
  }
}

/**
 * Body of `POST /approvals/spaces` on 201 Created.
 *
 * Verified by reading the consumers: `src/infra/atlassian/client.js` derives
 * `ok` from the HTTP status and never inspects the body,
 * `src/services/space-requests.js` passes `res.data` straight through, and
 * `src/pages/space-requests/new/controller.js` builds its yar payload from the
 * submitted request rather than the response. Nothing in `src/` reads a
 * `success` field, so the body is a plain resource representation - the same
 * shape `GET /approvals/spaces/{spaceKey}` returns.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {Object}
 */
function createdSpaceRequest (overrides = {}) {
  return {
    id: 'req-1',
    spaceKey: 'FARM',
    products: {
      [products.JIRA]: productDecision(),
      [products.CONFLUENCE]: productDecision()
    },
    ...overrides
  }
}

/**
 * Body of `POST /approvals/spaces` on 409 Conflict.
 *
 * Verified against `src/infra/atlassian/client.js`: 409 is passed as an
 * `expected` status by `src/infra/atlassian/approvals.js`, and the client
 * returns `{ok: false, status, data: null}` for expected statuses - it discards
 * the body. So this shape is documentation of what upstream sends; no
 * production code reads it.
 *
 * @param {Object} [overrides] - Fields to override on the error body
 * @returns {{message: string}}
 */
function spaceRequestConflict (overrides = {}) {
  return {
    message: 'Space approval request already exists',
    ...overrides
  }
}

/**
 * One element of `GET /admin/access-requests`, and the body of
 * `GET /approvals/spaces/{spaceKey}` on 200.
 *
 * Every field crosses the wire camelCased, as the approvals models upstream do.
 *
 * Note what is absent: there is no top-level `status`. A request has one status
 * per product and no single one of its own, so the portal derives what a
 * listing row should say - see `deriveOverallStatus` in
 * `src/services/space-requests.js` - rather than reading a field that would
 * have to pick one of two answers.
 *
 * Upstream carries no space *title*, which is why the spaces directory falls
 * back to the space key as its display name.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {Object}
 */
function accessRequest (overrides = {}) {
  return {
    id: 'req-1',
    userId: 'requester@defra.gov.uk',
    spaceKey: 'FARM',
    reason: 'Need this space for a workshop',
    iao: 'iao@defra.gov.uk',
    products: {
      [products.JIRA]: productDecision(),
      [products.CONFLUENCE]: productDecision()
    },
    dataHandlingFormRef: null,
    riskAssessmentRef: null,
    createdAt: '2026-08-21T11:40:00.000Z',
    ...overrides
  }
}

/**
 * Body of `GET /admin/access-requests` on 200 - a bare JSON array.
 *
 * Upstream returns *pending* requests only and accepts no filters, and
 * serialises the list with no envelope.
 *
 * @param {Object[]} [requests] - Requests to return
 * @returns {Object[]}
 */
function accessRequestList (requests = [accessRequest()]) {
  return requests
}

/**
 * Body of `POST /tokens` on 201 Created.
 *
 * Unlike every other shape in this file its fields cross the wire in
 * `snake_case`: the token router's models upstream carry no camelCase alias
 * generator. `services/personal-tokens.js` is the one place that maps them.
 *
 * `token` is the plaintext secret, `amcp_` + a random suffix, and appears in
 * this response and nowhere else - upstream persists only its SHA-256 hash.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {{id: string, token: string, label: string, expires_at: string}}
 */
function mintedToken (overrides = {}) {
  return {
    id: 'pat_3f9c1a2b4d5e6f708192a3b4c5d6e7f8',
    token: 'example-token-for-testing',
    label: 'Claude Code',
    expires_at: '2026-11-28T10:15:30.123456Z',
    ...overrides
  }
}

/**
 * One element of `GET /tokens` on 200.
 *
 * Note what is absent: there is no `token` field - the secret is returned once,
 * by the mint call, and never again.
 *
 * `status` is upstream's own word, read straight through by
 * `services/personal-tokens.js` and lower-cased; a summary without one renders
 * as "Unknown" rather than being derived from `revoked_at`/`expires_at`.
 *
 * `prefix` is the first 13 characters of the secret, stored by upstream for
 * display so a user can tell their tokens apart.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {Object}
 */
function tokenSummary (overrides = {}) {
  return {
    id: 'pat_3f9c1a2b4d5e6f708192a3b4c5d6e7f8',
    label: 'Claude Code',
    prefix: 'amcp_xJ8v3kQz',
    created_at: '2026-08-30T10:15:30.123456Z',
    expires_at: '2026-11-28T10:15:30.123456Z',
    last_used_at: null,
    revoked_at: null,
    ...overrides
  }
}

/**
 * Body of `GET /tokens` on 200 - a bare JSON array, no envelope.
 *
 * @param {Object[]} [tokens] - Tokens to return
 * @returns {Object[]}
 */
function tokenList (tokens = [tokenSummary()]) {
  return tokens
}

export {
  productDecision,
  productNotRequested,
  createdSpaceRequest,
  spaceRequestConflict,
  accessRequest,
  accessRequestList,
  mintedToken,
  tokenSummary,
  tokenList
}
