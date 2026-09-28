import { statusCodes } from '../../../constants/status-codes.js'
import {
  listTokens,
  mintToken,
  revokeToken
} from '../../../services/personal-tokens.js'
import { config } from '../../../config/config.js'
import {
  TokenListViewModel,
  MintTokenFormViewModel,
  CreatedTokenViewModel,
  RevokeTokenViewModel
} from './view-model.js'

const TOKENS_VIEW = 'account/tokens/page.njk'
const NEW_TOKEN_VIEW = 'account/tokens/new/new.njk'
const CREATED_TOKEN_VIEW = 'account/tokens/created/created.njk'
const REVOKE_TOKEN_VIEW = 'account/tokens/revoke/revoke.njk'

const TOKENS_PATH = '/account/tokens'

/**
 * Session keys. Both are flashes - read once and gone - because both carry
 * something that is true of a moment rather than of the user: the secret you
 * have just been given, and the fact that you have just revoked something.
 */
const NEW_TOKEN_SESSION_KEY = 'newPersonalToken'
const REVOKED_TOKEN_SESSION_KEY = 'revokedPersonalToken'

/**
 * GET /account/tokens - the tokens this user has.
 *
 * Deliberately not gated by `requiresAtlassianLink`. Minting a token is a
 * portal and `atlassian-mcp` concern that never touches Atlassian, and locking
 * the page would mean a user whose Atlassian connection has lapsed could not
 * revoke a leaked credential. The connection is reported instead of enforced:
 * without it the token will authenticate but the MCP tools behind it cannot
 * read any space.
 */
async function getTokens (request, h) {
  const userId = request.auth.credentials.profile.email

  const result = await listTokens(userId)

  const viewModel = TokenListViewModel.fromTokens(result, {
    revokedLabel: request.yar.flash(REVOKED_TOKEN_SESSION_KEY)[0] ?? null
  })

  return h.view(TOKENS_VIEW, { ...viewModel }).code(statusCodes.HTTP_STATUS_OK)
}

/**
 * GET /account/tokens/new - the generate form.
 */
async function getNewToken (_request, h) {
  const viewModel = MintTokenFormViewModel.empty()

  return h.view(NEW_TOKEN_VIEW, { ...viewModel }).code(statusCodes.HTTP_STATUS_OK)
}

function postNewTokenFailAction (request, h, err) {
  const viewModel = MintTokenFormViewModel.fromValidationError(request.payload, err)

  return h.view(NEW_TOKEN_VIEW, { ...viewModel })
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST).takeover()
}

/**
 * POST /account/tokens/new - mint the token, then redirect to the page that
 * displays it.
 *
 * The redirect is what makes the secret safe to show. Rendering it straight
 * from this response would put a credential behind a URL the browser will
 * re-submit on refresh, minting another token every time. Flashing it instead
 * means the secret survives exactly one GET and cannot be recovered by going
 * back - which is the same promise `atlassian-mcp` makes by storing only its hash.
 */
async function postNewToken (request, h) {
  const userId = request.auth.credentials.profile.email

  const token = await mintToken(userId, {
    label: request.payload.label,
    ttlDays: request.payload.ttlDays
  })

  request.yar.flash(NEW_TOKEN_SESSION_KEY, token)

  return h.redirect(`${TOKENS_PATH}/created`).code(statusCodes.HTTP_STATUS_FOUND)
}

/**
 * GET /account/tokens/created - the secret, shown once.
 *
 * An empty flash means the user has arrived here without having just minted
 * something: a bookmark, a back button, or a refresh after reading it. There
 * is nothing to show and nothing to apologise for, so send them to the listing
 * where their new token is already waiting.
 */
async function getCreatedToken (request, h) {
  const token = request.yar.flash(NEW_TOKEN_SESSION_KEY)[0]

  if (!token) {
    return h.redirect(TOKENS_PATH).code(statusCodes.HTTP_STATUS_FOUND)
  }

  const viewModel = CreatedTokenViewModel.fromToken(
    token,
    config.get('atlassianMcp.publicUrl')
  )

  return h.view(CREATED_TOKEN_VIEW, { ...viewModel }).code(statusCodes.HTTP_STATUS_OK)
}

/**
 * GET /account/tokens/{tokenId}/revoke - confirm before revoking.
 *
 * The token is looked up in the user's own listing rather than fetched by id,
 * because `atlassian-mcp` has no endpoint for a single token and because the
 * listing is already scoped to the caller - a token that is not in it is not
 * theirs, which is exactly the case this page must refuse.
 */
async function getRevokeToken (request, h) {
  const userId = request.auth.credentials.profile.email

  const { tokens, listError } = await listTokens(userId)
  const token = tokens.find((candidate) => candidate.id === request.params.tokenId)

  // A failed listing is indistinguishable from an empty one here, so treat it
  // as "cannot confirm this" and send the user to the page that explains why.
  if (listError || !token) {
    return h.redirect(TOKENS_PATH).code(statusCodes.HTTP_STATUS_FOUND)
  }

  const viewModel = RevokeTokenViewModel.fromToken(token)

  return h.view(REVOKE_TOKEN_VIEW, { ...viewModel }).code(statusCodes.HTTP_STATUS_OK)
}

/**
 * POST /account/tokens/{tokenId}/revoke - revoke it.
 *
 * A 404 from upstream is not reported as an error. It means the token is
 * already gone - revoked in another tab, or the id was never the user's - and
 * in both cases the user's intent is satisfied and the listing they are sent
 * to shows the truth.
 */
async function postRevokeToken (request, h) {
  const userId = request.auth.credentials.profile.email

  const result = await revokeToken(userId, request.params.tokenId)

  if (result.success) {
    request.yar.flash(REVOKED_TOKEN_SESSION_KEY, request.payload?.label ?? null)
  }

  return h.redirect(TOKENS_PATH).code(statusCodes.HTTP_STATUS_FOUND)
}

export {
  getTokens,
  getNewToken,
  postNewToken,
  postNewTokenFailAction,
  getCreatedToken,
  getRevokeToken,
  postRevokeToken,
  NEW_TOKEN_SESSION_KEY,
  REVOKED_TOKEN_SESSION_KEY
}
