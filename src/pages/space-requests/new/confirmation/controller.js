import { statusCodes } from '../../../../constants/status-codes.js'
import { SpaceRequestConfirmationViewModel } from './view-models.js'

async function getConfirmation (request, h) {
  const spaceRequest = request.yar.get('spaceRequest', true)

  if (!spaceRequest) {
    return h.redirect('/space-requests/new').code(statusCodes.HTTP_STATUS_FOUND)
  }

  const viewModel = SpaceRequestConfirmationViewModel.fromSession(spaceRequest)

  return h.view('space-requests/new/confirmation/confirmation.njk', { spaceRequest: { ...viewModel } })
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getConfirmation
}
