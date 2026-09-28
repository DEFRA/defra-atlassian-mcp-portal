import * as dashboardController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/dashboard',
    handler: dashboardController.getDashboard
  }
]

export {
  routes
}
