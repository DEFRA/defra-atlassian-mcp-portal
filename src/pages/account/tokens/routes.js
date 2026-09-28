import * as tokensController from './controller.js'
import { mintTokenSchema, revokeTokenSchema } from './schemas.js'

const atlassianLinkOptions = {
  requiresAtlassianLink: true,
  atlassianLinkReason: 'generate an access token'
}

const routes = [
  {
    method: 'GET',
    path: '/account/tokens',
    options: {
      app: atlassianLinkOptions
    },
    handler: tokensController.getTokens
  },
  {
    method: 'GET',
    path: '/account/tokens/new',
    options: {
      app: atlassianLinkOptions
    },
    handler: tokensController.getNewToken
  },
  {
    method: 'POST',
    path: '/account/tokens/new',
    options: {
      app: atlassianLinkOptions,
      validate: {
        payload: mintTokenSchema,
        failAction: tokensController.postNewTokenFailAction
      }
    },
    handler: tokensController.postNewToken
  },
  {
    method: 'GET',
    path: '/account/tokens/created',
    options: {
      app: atlassianLinkOptions
    },
    handler: tokensController.getCreatedToken
  },
  {
    method: 'GET',
    path: '/account/tokens/{tokenId}/revoke',
    options: {
      app: atlassianLinkOptions
    },
    handler: tokensController.getRevokeToken
  },
  {
    method: 'POST',
    path: '/account/tokens/{tokenId}/revoke',
    options: {
      app: atlassianLinkOptions,
      validate: {
        payload: revokeTokenSchema
      }
    },
    handler: tokensController.postRevokeToken
  }
]

export {
  routes
}
