import { statusCodes } from '../../constants/status-codes.js'
import { atlassianClient } from './client.js'

/**
 * Personal access tokens - the credentials an MCP client presents to
 * `atlassian-mcp` as `Authorization: Bearer amcp_...`.
 *
 * Thin transport over `../atlassian-mcp/app/infra/rest/token_router.py`, mounted
 * at `/tokens`. Bodies here are upstream's own `snake_case`: that router's
 * pydantic models are plain, unlike the approvals ones, which carry
 * `alias_generator=to_camel` and therefore cross the wire camelCased. The
 * mapping to the portal's camelCase belongs to `services/personal-tokens.js`,
 * so that a reader comparing this file against the router sees the same field
 * names in both.
 *
 * Note the trusted-header caveat upstream documents: these routes authenticate
 * on `X-User-Id` alone, whatever `REST_AUTH_MODE` says, because a caller who
 * has not minted a token yet has nothing else to present. They are only safe
 * while `atlassian-mcp` is reachable by the portal and not the public.
 */

/**
 * Mint a new personal access token.
 *
 * The plaintext secret comes back in this response and nowhere else - upstream
 * stores only a SHA-256 hash of it, so neither the listing nor a second call
 * here can return it again.
 *
 * @param {string} userId - The token's owner, sent as the `X-User-Id` header
 * @param {{label: string, ttlDays: number}} details - The token's name and lifetime in days
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {AtlassianMcpError} - When the response is not ok
 */
async function mintToken (userId, details) {
  return atlassianClient.request('/tokens', {
    method: 'POST',
    body: {
      label: details.label,
      ttl_days: details.ttlDays
    },
    userId
  })
}

/**
 * List every personal access token belonging to a user, including revoked and
 * expired ones.
 *
 * @param {string} userId - The token owner, sent as the `X-User-Id` header
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {AtlassianMcpError} - When the response is not ok
 */
async function listTokens (userId) {
  return atlassianClient.request('/tokens', { userId })
}

/**
 * Revoke a personal access token.
 *
 * 404 is expected: the token may already have been revoked in another tab.
 * Upstream also answers 404 for a token belonging to someone else, which is
 * deliberately indistinguishable from one that does not exist - so callers
 * must not report it as "not yours".
 *
 * Upstream answers 204 with an empty body. `AtlassianClient.request` already
 * handles that: the `response.json()` parse fails and `data` comes back null.
 *
 * @param {string} userId - The token owner, sent as the `X-User-Id` header
 * @param {string} tokenId - The token to revoke
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {AtlassianMcpError} - When the response is not ok and not a 404
 */
async function revokeToken (userId, tokenId) {
  return atlassianClient.request(`/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
    userId,
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
  })
}

export {
  mintToken,
  listTokens,
  revokeToken
}
