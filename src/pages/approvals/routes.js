import * as approvalsController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/approvals',
    handler: approvalsController.getApprovals
  }
]

export {
  routes
}
