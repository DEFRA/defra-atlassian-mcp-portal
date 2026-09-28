import * as spaceRequestController from './controller.js'
import { spaceRequestSchema } from './schemas.js'

/**
 * Kept behind `requiresAtlassianLink` even though submitting a request only
 * writes to atlassian-mcp's governance store today, and so does not currently
 * need an Atlassian token.
 *
 * The gate is here for what comes next: requesting a space is to be extended
 * with a check that the requester can actually reach the space in Atlassian,
 * which does need their connection. The same check is planned on the
 * Information Asset Owner's decision page, and `/approvals/{requestId}` will
 * need this option adding at that point.
 *
 * The spaces listing and space page are deliberately ungated.
 */
const routes = [
  {
    method: 'GET',
    path: '/space-requests/new',
    options: {
      app: { requiresAtlassianLink: true, atlassianLinkReason: 'request a space' }
    },
    handler: spaceRequestController.getNewSpaceRequest
  },
  {
    method: 'POST',
    path: '/space-requests/new',
    options: {
      app: { requiresAtlassianLink: true, atlassianLinkReason: 'request a space' },
      validate: {
        payload: spaceRequestSchema,
        failAction: spaceRequestController.postSpaceRequestFailAction
      }
    },
    handler: spaceRequestController.postSpaceRequest
  }
]

export {
  routes
}
