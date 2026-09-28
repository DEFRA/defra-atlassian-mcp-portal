import { config } from '../../config/config.js'

import * as loginController from './controller.js'

const callbackAuth = config.get('auth.provider') === 'entra'
  ? { mode: 'try', strategy: 'entra' }
  : false

const routes = [
  {
    method: 'GET',
    path: '/',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: loginController.getSignIn
  },
  {
    method: 'GET',
    path: '/login/callback',
    options: {
      auth: callbackAuth
    },
    handler: loginController.handleLoginCallback
  },
  {
    method: 'GET',
    path: '/logout',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: loginController.logout
  }
]

export {
  routes
}
