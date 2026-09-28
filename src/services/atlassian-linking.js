import { connectionChecks } from '../constants/connection-checks.js'
import { connectionFailureReasons } from '../constants/connection-failure-reasons.js'
import { linkingOutcomes } from '../constants/linking-outcomes.js'
import { statusCodes } from '../constants/status-codes.js'
import { createLogger } from '../infra/logging/logger.js'
import { buildErrorLog } from '../infra/logging/utils/build-error-log.js'
import * as linkingApi from '../infra/atlassian/linking.js'

const logger = createLogger()

/**
 * Get a user's Atlassian linking status, and - only when they're not
 * connected - an authorization URL to start linking.
 *
 * Either request failing (a thrown error) is treated as fatal to the page:
 * there's no useful state to show if we know the user isn't connected but
 * can't give them a way to connect, so both collapse to the same
 * `statusError` result.
 *
 * @param {string} userId - The user ID for which to get the linking status
 * @returns {Promise<{linkingStatus: object|null, statusError: boolean, authorizationUrl: string|null}>}
 */
async function getLinkingStatus (userId) {
  try {
    const linkingStatus = await _fetchLinkingStatus(userId)
    const authorizationUrl = linkingStatus.linked
      ? null
      : await _fetchAuthorizationUrl(userId)

    return { linkingStatus, statusError: false, authorizationUrl }
  } catch (error) {
    logger.warn(buildErrorLog(error, { type: 'atlassian_linking_status_failed' }))

    return { linkingStatus: null, statusError: true, authorizationUrl: null }
  }
}

/**
 * Check whether a user currently has a linked Atlassian account.
 *
 * Any failure - a non-ok response or a thrown error - is treated as "not connected" so
 * gated pages fail closed rather than assuming access.
 *
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>}
 */
async function isAtlassianLinked (userId) {
  try {
    const linkingStatus = await _fetchLinkingStatus(userId)

    return linkingStatus.linked
  } catch (error) {
    logger.error(buildErrorLog(error, { type: 'atlassian_connection_check_failed' }))

    return false
  }
}

/**
 * Verify that a stored Atlassian connection actually works.
 *
 * Fails soft to `UNAVAILABLE`, never to `FAILED`: a 404 (the Atlassian MCP server
 * has not shipped the endpoint yet), a network error or a malformed body all
 * mean "we could not check", which is not the same as "your connection is
 * broken" and must not be shown to the user as though it were.
 *
 * @param {string} userId - The user whose connection to verify
 * @returns {Promise<{state: string, profile: object|null, reason: string|null}>}
 *   state is one of `connectionChecks`
 */
async function verifyConnection (userId) {
  try {
    const response = await linkingApi.testConnection(userId)

    if (response.ok && response.data.status === 'success') {
      return _checkResult(connectionChecks.VERIFIED, {
        profile: response.data.profile ?? null
      })
    }

    return _checkResult(connectionChecks.FAILED, {
      reason: _mapTestFailureReason(response.status)
    })
  } catch (error) {
    logger.warn(buildErrorLog(error, { type: 'atlassian_connection_test_failed' }))

    return _checkResult(connectionChecks.UNAVAILABLE)
  }
}

/**
 * Get an authorization URL on its own.
 *
 * `getLinkingStatus` only fetches one when the user is not linked. A
 * connection that is stored but no longer works needs one too, so the page can
 * offer a reconnect - hence a separate, fail-soft call made only in that case
 * rather than an extra round trip on every load.
 *
 * @param {string} userId
 * @returns {Promise<string|null>} The URL, or null if one could not be fetched
 */
async function getAuthorizationUrl (userId) {
  try {
    return await _fetchAuthorizationUrl(userId)
  } catch (error) {
    logger.warn(buildErrorLog(error, { type: 'atlassian_authorization_url_failed' }))

    return null
  }
}

/**
 * @private
 */
function _checkResult (state, { profile = null, reason = null } = {}) {
  return { state, profile, reason }
}

/**
 * Complete the OAuth linking flow
 *
 * Interprets the OAuth callback response and classifies the outcome into
 * a discriminated result, using the fixed outcome codes in
 * `linkingOutcomes` rather than ad-hoc strings.
 *
 * @param {string} userId - The user ID
 * @param {object} params - OAuth callback parameters
 * @param {string} params.code - The authorization code
 * @param {string} params.state - The CSRF state parameter
 * @returns {Promise<{outcome: string}>} outcome is one of `linkingOutcomes`
 */
async function completeLinking (userId, params) {
  try {
    const response = await linkingApi.completeLinking(userId, params)

    if (response.ok) {
      return { outcome: linkingOutcomes.SUCCESS }
    }

    if (response.status === statusCodes.HTTP_STATUS_BAD_REQUEST) {
      return { outcome: linkingOutcomes.VALIDATION_FAILED }
    }

    logger.error(buildErrorLog(new Error(`Unexpected status ${response.status}`), {
      type: 'atlassian_linking_completion_failed'
    }))

    return { outcome: linkingOutcomes.FAILED }
  } catch (error) {
    logger.error(buildErrorLog(error, { type: 'atlassian_linking_completion_failed' }))

    return { outcome: linkingOutcomes.FAILED }
  }
}

/**
 * @private
 * Fetch a user's linking status from the Atlassian MCP API.
 *
 * Throws on a non-ok response from the infra layer (AtlassianMcpError).
 *
 * @param {string} userId - The user ID for which to check linking status
 * @returns {Promise<object>} The linking status data
 * @throws {AtlassianMcpError} - On any non-ok response
 */
async function _fetchLinkingStatus (userId) {
  const response = await linkingApi.checkLinkingStatus(userId)

  return response.data
}

/**
 * @private
 * Fetch an authorization URL from the Atlassian MCP API.
 *
 * Throws on a non-ok response from the infra layer (AtlassianMcpError) —
 * `getLinkingStatus` only calls this when the user needs to link, so
 * failing to get them a link is handled by the caller's try/catch.
 *
 * @param {string} userId - The user ID for which to get the authorization URL
 * @returns {Promise<string>} The authorization URL
 * @throws {AtlassianMcpError} - On any non-ok response
 */
async function _fetchAuthorizationUrl (userId) {
  const response = await linkingApi.getAuthorizationUrl(userId)

  return response.data.authorizationUrl
}

/**
 * Map an HTTP status code from a test connection response to a failure reason.
 *
 * Returns a `connectionFailureReasons` code, not user-facing text - it's the
 * linking page view model's job to turn that into something to show.
 *
 * @param {number} status - The HTTP status code
 * @returns {string|null} A `connectionFailureReasons` code, or null if unknown
 */
function _mapTestFailureReason (status) {
  if (status === statusCodes.HTTP_STATUS_UNAUTHORIZED) {
    return connectionFailureReasons.UNAUTHORIZED
  }

  if (status === statusCodes.HTTP_STATUS_BAD_GATEWAY) {
    return connectionFailureReasons.ATLASSIAN_API_ERROR
  }

  return null
}

export {
  getLinkingStatus,
  isAtlassianLinked,
  verifyConnection,
  getAuthorizationUrl,
  completeLinking
}
