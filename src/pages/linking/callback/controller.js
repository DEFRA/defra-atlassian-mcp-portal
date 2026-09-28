import { linkingOutcomes, LINKING_OUTCOME_SESSION_KEY } from '../../../constants/linking-outcomes.js'
import { ATLASSIAN_LINK_REQUIRED_SESSION_KEY } from '../../../constants/atlassian-link-required.js'
import { completeLinking } from '../../../services/atlassian-linking.js'

/**
 * Handle Atlassian OAuth callback
 *
 * On success, if this linking flow was started by a gated route (the
 * `atlassianConnection` plugin stashes where the user was headed), sends them
 * straight back to whatever they originally tried to reach rather than to
 * the linking page - no message needed, they'll just see the page they
 * asked for. Otherwise flashes the outcome code into the session - the
 * linking page controller owns turning that code into a displayable
 * message.
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 *
 * @returns {import('@hapi/hapi').ResponseObject} The response object
 */
async function handleAtlassianLinkingCallback (request, h) {
  const userId = request.auth.credentials.profile.email
  const { code, error, state } = request.query

  if (error || !code) {
    request.yar.flash(LINKING_OUTCOME_SESSION_KEY, linkingOutcomes.CANCELLED)
    return h.redirect('/account/atlassian-linking')
  }

  const result = await completeLinking(userId, { code, state })

  if (result.outcome === linkingOutcomes.SUCCESS) {
    const required = request.yar.get(ATLASSIAN_LINK_REQUIRED_SESSION_KEY)

    if (required) {
      request.yar.clear(ATLASSIAN_LINK_REQUIRED_SESSION_KEY)
      return h.redirect(required.returnTo)
    }
  }

  request.yar.flash(LINKING_OUTCOME_SESSION_KEY, result.outcome)

  return h.redirect('/account/atlassian-linking')
}

export {
  handleAtlassianLinkingCallback
}
