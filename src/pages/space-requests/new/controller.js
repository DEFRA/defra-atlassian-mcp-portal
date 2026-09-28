import { statusCodes } from '../../../constants/status-codes.js'
import { orderedProducts } from '../../../constants/products.js'
import { spaceStatuses } from '../../../constants/space-statuses.js'
import { SpaceRequestFormViewModel } from './view-models.js'
import { submitSpaceRequest } from '../../../services/space-requests.js'

const NEW_SPACE_REQUEST_VIEW = 'space-requests/new/new.njk'

/**
 * GET /space-requests/new - by the time this runs, the `atlassianConnection`
 * server plugin has already redirected away any request that isn't Atlassian
 * linked (see `routes.js`'s `requiresAtlassianLink` option), so no guard is
 * needed here.
 *
 * `?spaceKey=` prefills the form. The space page links here that way when a
 * space has never been requested, or was rejected and can be requested again,
 * so the user doesn't have to copy the key across by hand.
 */
async function getNewSpaceRequest (request, h) {
  const viewModel = SpaceRequestFormViewModel.empty(request.query.spaceKey)

  return h.view(NEW_SPACE_REQUEST_VIEW, { ...viewModel })
    .code(statusCodes.HTTP_STATUS_OK)
}

async function postSpaceRequestFailAction (request, h, err) {
  const viewModel = SpaceRequestFormViewModel.fromValidationError(request.payload, err)

  return h.view(NEW_SPACE_REQUEST_VIEW, { ...viewModel })
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST).takeover()
}

/**
 * POST /space-requests/new - same Atlassian-linked guarantee as
 * `getNewSpaceRequest`, enforced by the `atlassianConnection` server plugin.
 */
async function postSpaceRequest (request, h) {
  const { spaceKey, iao, reason } = request.payload

  // Joi's `.single()` leaves a one-box tick as a bare string.
  const products = [request.payload.products].flat()

  const userId = request.auth.credentials.profile.email

  const spaceRequest = {
    spaceKey,
    iao,
    reason,
    products,
    userId
  }

  const result = await submitSpaceRequest(spaceRequest)

  if (result.success) {
    request.yar.set('spaceRequest', {
      spaceKey,
      iao,
      email: userId,
      products: _pendingProducts(products),
      status: spaceStatuses.PENDING,
      submittedAt: new Date().toISOString()
    })

    return h.redirect('/space-requests/new/confirmation').code(statusCodes.HTTP_STATUS_FOUND)
  }

  const conflictMessage = 'A request for this space already exists'

  const viewModel = new SpaceRequestFormViewModel({
    spaceKey,
    iao,
    reason,
    products,
    errors: {
      spaceKey: { text: conflictMessage }
    },
    errorList: [
      { text: conflictMessage, href: '#spaceKey' }
    ]
  })

  return h.view(NEW_SPACE_REQUEST_VIEW, { ...viewModel })
    .code(statusCodes.HTTP_STATUS_CONFLICT)
}

/**
 * @private
 * The just-submitted request in the same per-product shape upstream returns, so
 * the confirmation page reads one structure whether it is showing what we just
 * sent or what upstream sent back. Everything asked for is pending, because a
 * request is only ever born pending; everything else is not requested.
 */
function _pendingProducts (requested) {
  return Object.fromEntries(orderedProducts.map((code) => [
    code,
    requested.includes(code)
      ? { requested: true, status: spaceStatuses.PENDING }
      : { requested: false, status: spaceStatuses.NOT_REQUESTED }
  ]))
}

export {
  getNewSpaceRequest,
  postSpaceRequest,
  postSpaceRequestFailAction
}
