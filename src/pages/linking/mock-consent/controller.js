import { statusCodes } from '../../../constants/status-codes.js'

/**
 * Get the simulated Atlassian consent page controller
 *
 * Stands in for Atlassian's real OAuth consent screen when linking is being
 * simulated (see `src/infra/atlassian/linking.js`) - reached only because
 * `getAuthorizationUrl` pointed the user here instead of at a real Atlassian
 * URL. Approve/Deny both link straight to the real callback route.
 *
 * @param {import('@hapi/hapi').Request} _request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 *
 * @returns {import('@hapi/hapi').ResponseObject} The response object for the mock consent page
 */
async function getMockConsentPage (_request, h) {
  return h.view('linking/mock-consent/page.njk').code(statusCodes.HTTP_STATUS_OK)
}

export {
  getMockConsentPage
}
