import { vi } from 'vitest'

import Hapi from '@hapi/hapi'

vi.mock('../../../../src/services/atlassian-linking.js')

import { DEFAULT_ATLASSIAN_LINK_REASON, ATLASSIAN_LINK_REQUIRED_SESSION_KEY } from '../../../../src/constants/atlassian-link-required.js'
import { isAtlassianLinked } from '../../../../src/services/atlassian-linking.js'
import { atlassianConnection } from '../../../../src/server/plugins/atlassian-connection.js'

/**
 * Boots a minimal Hapi server with the real `atlassianConnection` plugin
 * registered, a gated and an ungated throwaway route, and a fake identity
 * plus a fake `yar` (session) decoration stamped onto the request before
 * the plugin's `onPreHandler` extension runs - standing in for a real auth
 * strategy and the real `yar` plugin having already run.
 */
async function buildServer ({ authenticated = true } = {}) {
  const server = Hapi.server()
  const set = vi.fn()

  server.ext('onPreAuth', (request, h) => {
    if (authenticated) {
      request.auth = { isAuthenticated: true }
      request.auth.credentials = { profile: { email: 'user@example.com' } }
    }

    request.yar = { set }

    return h.continue
  })

  await server.register(atlassianConnection)

  server.route({
    method: 'GET',
    path: '/gated',
    options: { app: { requiresAtlassianLink: true, atlassianLinkReason: 'do the gated thing' } },
    handler: (request, h) => h.response({ atlassianConnected: request.app.atlassianConnected })
  })

  server.route({
    method: 'GET',
    path: '/gated-no-reason',
    options: { app: { requiresAtlassianLink: true } },
    handler: (request, h) => h.response({ atlassianConnected: request.app.atlassianConnected })
  })

  server.route({
    method: 'GET',
    path: '/ungated',
    handler: (request, h) => h.response({ atlassianConnected: request.app.atlassianConnected })
  })

  return { server, set }
}

describe('atlassianConnectionPlugin', () => {
  test('lets a connected request through, decorated with atlassianConnected', async () => {
    isAtlassianLinked.mockResolvedValue(true)
    const { server } = await buildServer()

    const { statusCode, result } = await server.inject({ method: 'GET', url: '/gated' })

    expect(statusCode).toBe(200)
    expect(result.atlassianConnected).toBe(true)
    expect(isAtlassianLinked).toHaveBeenCalledWith('user@example.com')
  })

  test('redirects to the connect-Atlassian gate page and stashes the return path and reason when not connected', async () => {
    isAtlassianLinked.mockResolvedValue(false)
    const { server, set } = await buildServer()

    const { statusCode, headers } = await server.inject({ method: 'GET', url: '/gated' })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/account/atlassian-linking')
    expect(set).toHaveBeenCalledWith(ATLASSIAN_LINK_REQUIRED_SESSION_KEY, {
      returnTo: '/gated',
      reason: 'do the gated thing'
    })
  })

  test('stashes a default reason when the route does not give one', async () => {
    isAtlassianLinked.mockResolvedValue(false)
    const { server, set } = await buildServer()

    await server.inject({ method: 'GET', url: '/gated-no-reason' })

    expect(set).toHaveBeenCalledWith(ATLASSIAN_LINK_REQUIRED_SESSION_KEY, {
      returnTo: '/gated-no-reason',
      reason: DEFAULT_ATLASSIAN_LINK_REASON
    })
  })

  test('does not check connection status on a route that does not require it', async () => {
    const { server, set } = await buildServer()

    const { statusCode, result } = await server.inject({ method: 'GET', url: '/ungated' })

    expect(statusCode).toBe(200)
    expect(result.atlassianConnected).toBeUndefined()
    expect(isAtlassianLinked).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  test('redirects to sign in when there is no authenticated user', async () => {
    const { server, set } = await buildServer({ authenticated: false })

    const { statusCode, headers } = await server.inject({ method: 'GET', url: '/gated' })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/')
    expect(isAtlassianLinked).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })
})
