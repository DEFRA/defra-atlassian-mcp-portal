import * as confirmationController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/space-requests/new/confirmation',
    handler: confirmationController.getConfirmation
  }
]

export {
  routes
}
