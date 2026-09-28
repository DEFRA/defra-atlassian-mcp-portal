import * as callbackController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/account/atlassian-linking/callback',
    handler: callbackController.handleAtlassianLinkingCallback
  }
]

export {
  routes
}
