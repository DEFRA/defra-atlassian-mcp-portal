import { statusCodes } from '../../constants/status-codes.js'

/**
 * Get "My approvals" page controller
 *
 * Placeholder page - the real approvals listing (built on top of the
 * `infra/atlassian/approvals.js` API client) is future work. This just
 * establishes the route and nav entry.
 *
 * Deliberately not gated behind `requiresAtlassianLink`: there's no
 * Atlassian-backed content here yet, so forcing the OAuth connection flow
 * would only add friction for a page that has nothing to show either way.
 *
 * @param {import('@hapi/hapi').Request} _request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 *
 * @returns {import('@hapi/hapi').ResponseObject} The response object for the approvals page
 */
async function getApprovals (_request, h) {
  return h.view('approvals/page.njk', { pageTitle: 'My approvals' })
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getApprovals
}
