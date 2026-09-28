import { LINKING_OUTCOME_SESSION_KEY } from '../../constants/linking-outcomes.js'
import { ATLASSIAN_LINK_REQUIRED_SESSION_KEY } from '../../constants/atlassian-link-required.js'
import { statusCodes } from '../../constants/status-codes.js'
import { connectionChecks } from '../../constants/connection-checks.js'
import {
  getLinkingStatus,
  verifyConnection,
  getAuthorizationUrl
} from '../../services/atlassian-linking.js'
import { LinkingStatusViewModel } from './view-model.js'

/**
 * GET /account/atlassian-linking - the user's Atlassian connection management page.
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 *
 * @returns {import('@hapi/hapi').ResponseObject} The response object for the linking page
 */
async function getAtlassianLinkingPage (request, h) {
  const userId = request.auth.credentials.profile.email

  const outcome = request.yar.flash(LINKING_OUTCOME_SESSION_KEY)[0]
  const required = request.yar.get(ATLASSIAN_LINK_REQUIRED_SESSION_KEY)

  const status = await getLinkingStatus(userId)
  const linked = Boolean(!status.statusError && status.linkingStatus?.linked)

  if (required && linked) {
    request.yar.clear(ATLASSIAN_LINK_REQUIRED_SESSION_KEY)

    return h.redirect(required.returnTo).code(statusCodes.HTTP_STATUS_FOUND)
  }

  const check = linked
    ? await verifyConnection(userId)
    : null

  const reconnectUrl = check?.state === connectionChecks.FAILED
    ? await getAuthorizationUrl(userId)
    : null

  const viewModel = LinkingStatusViewModel.fromLinkingStatus(status, {
    outcome,
    requiredReason: required?.reason ?? null,
    userEmail: userId,
    check,
    reconnectUrl
  })

  return h.view('linking/page.njk', viewModel).code(statusCodes.HTTP_STATUS_OK)
}

export {
  getAtlassianLinkingPage
}
