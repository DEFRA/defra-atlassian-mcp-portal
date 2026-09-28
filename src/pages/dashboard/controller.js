import { statusCodes } from '../../constants/status-codes.js'
import { getLinkingStatus } from '../../services/atlassian-linking.js'
import { DashboardViewModel } from './view-model.js'

/**
 * Get dashboard page controller
 *
 * The post-login landing page: links to the service's features plus an
 * Atlassian connection status card. Reuses `getLinkingStatus`, the same
 * service call `linking/controller.js` uses for the full linking page -
 * it already fails soft (`statusError: true`) on any Atlassian API error
 * rather than throwing, so an Atlassian outage degrades this card, not the
 * whole dashboard.
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 *
 * @returns {import('@hapi/hapi').ResponseObject} The response object for the dashboard page
 */
async function getDashboard (request, h) {
  const userId = request.auth.credentials.profile.email

  const status = await getLinkingStatus(userId)
  const viewModel = DashboardViewModel.fromLinkingStatus(status)

  return h.view('dashboard/page.njk', viewModel).code(statusCodes.HTTP_STATUS_OK)
}

export {
  getDashboard
}
