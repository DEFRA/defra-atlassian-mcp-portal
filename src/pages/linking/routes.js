import * as linkingController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/account/atlassian-linking',
    handler: linkingController.getAtlassianLinkingPage
  }
]

export {
  routes
}
