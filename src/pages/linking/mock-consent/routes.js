import * as mockConsentController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/account/atlassian-linking/mock-consent',
    handler: mockConsentController.getMockConsentPage
  }
]

export {
  routes
}
