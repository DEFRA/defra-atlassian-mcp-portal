import { describe, test, expect } from 'vitest'

import { viewPlugin } from '../../../../src/server/plugins/views.js'

/**
 * What every page renders from this context - service name, support channel,
 * CSP nonce, signed-in identity - is asserted against real rendered HTML in
 * `tests/integration/pages/home/home.test.js` and, for `userEmail`, in
 * `tests/integration/pages/linking/linking.test.js`.
 *
 * What is left here is only the fallbacks no rendered page can reach: a request
 * that never went through the auth strategy, or a profile without the field.
 */
describe('viewPlugin context', () => {
  test('reports the request as signed out when it carries no auth', () => {
    const context = viewPlugin.options.context()

    expect(context.isAuthenticated).toBe(false)
    expect(context.userDisplayName).toBeNull()
    expect(context.userEmail).toBeNull()
  })

  test('reports the request as signed out when authentication failed', () => {
    const context = viewPlugin.options.context({ auth: { isAuthenticated: false } })

    expect(context.isAuthenticated).toBe(false)
    expect(context.userDisplayName).toBeNull()
  })

  test('falls back to null identity when the credentials carry no profile', () => {
    const context = viewPlugin.options.context({
      auth: { isAuthenticated: true, credentials: {} }
    })

    expect(context.isAuthenticated).toBe(true)
    expect(context.userDisplayName).toBeNull()
    expect(context.userEmail).toBeNull()
  })

  test('leaves cspNonce undefined when Blankie generated no nonces', () => {
    const context = viewPlugin.options.context({ plugins: { blankie: {} } })

    expect(context.cspNonce).toBeUndefined()
  })
})
