import { statusCodes } from '../constants/status-codes.js'
import { createLogger } from '../infra/logging/logger.js'
import { buildErrorLog } from '../infra/logging/utils/build-error-log.js'
import * as tokensApi from '../infra/atlassian/tokens.js'
import { tokenStatuses } from '../constants/token-statuses.js'
const logger = createLogger()

/**
 * List a user's tokens, newest first.
 *
 * @param {string} userId - The signed-in user
 * @returns {Promise<{tokens: object[], listError: boolean}>}
 */
async function listTokens (userId) {
  try {
    const res = await tokensApi.listTokens(userId)

    if (!res.ok) {
      throw _unexpectedStatus(res.status)
    }

    const tokens = (res.data ?? [])
      .map(_toTokenSummary)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

    return { tokens, listError: false }
  } catch (error) {
    logger.warn(buildErrorLog(error, { type: 'personal_token_list_failed' }))

    return { tokens: [], listError: true }
  }
}

/**
 * Mint a token and return its plaintext secret.
 *
 * Does *not* fail soft. The other calls here can degrade to a page that admits
 * it is missing something, but a mint either produced a credential or it did
 * not, and reporting a failure as an empty success would leave the user
 * believing they had a token they never received. The thrown error reaches the
 * hapi error handler and the standard error page.
 *
 * @param {string} userId - The token's owner
 * @param {{label: string, ttlDays: number}} details - The token's name and lifetime in days
 * @returns {Promise<{id: string, secret: string, label: string, expiresAt: string}>}
 * @throws {Error} - If the token could not be minted
 */
async function mintToken (userId, details) {
  const res = await tokensApi.mintToken(userId, details)

  if (!res.ok) {
    throw _unexpectedStatus(res.status)
  }

  return {
    id: res.data.id,
    secret: res.data.token,
    label: res.data.label,
    expiresAt: res.data.expires_at
  }
}

/**
 * Revoke a token.
 *
 * `notFound` covers both a token that never existed and one belonging to
 * another user - upstream answers 404 to both on purpose, so callers must
 * treat it as one outcome and say only that the token could not be found.
 *
 * @param {string} userId - The signed-in user
 * @param {string} tokenId - The token to revoke
 * @returns {Promise<{success: boolean, notFound: boolean}>}
 * @throws {Error} - If revocation fails with an unexpected status
 */
async function revokeToken (userId, tokenId) {
  const res = await tokensApi.revokeToken(userId, tokenId)

  if (res.ok) {
    return { success: true, notFound: false }
  }

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return { success: false, notFound: true }
  }

  throw _unexpectedStatus(res.status)
}

/**
 * @private
 * Upstream's `TokenSummaryResponse`, in the portal's own vocabulary.
 *
 * `prefix` is the first 13 characters of the secret and is safe to show - it
 * is stored for exactly this purpose, so a user with several tokens can tell
 * which line is which without the portal ever holding the secret itself.
 *
 * @param {object} record - An upstream token summary
 * @returns {object}
 */
function _toTokenSummary (record) {
  return {
    id: record.id,
    label: record.label,
    prefix: record.prefix,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    lastUsedAt: record.last_used_at,
    revokedAt: record.revoked_at,
    status: record.status?.toLowerCase() ?? tokenStatuses.UNKNOWN
  }
}

/**
 * @private
 */
function _unexpectedStatus (status) {
  const error = new Error(`Unexpected status ${status} from tokens API`)
  error.statusCode = status

  return error
}

export {
  listTokens,
  mintToken,
  revokeToken
}
