import { DEFAULT_ATLASSIAN_LINK_REASON, ATLASSIAN_LINK_REQUIRED_SESSION_KEY } from '../../constants/atlassian-link-required.js'
import { isAtlassianLinked } from '../../services/atlassian-linking.js'

/**
 * Guards routes that require a linked Atlassian account.
 *
 * Only runs for routes that opt in via `options.app.requiresAtlassianLink` -
 * most routes don't care about Atlassian linking, and this check costs an
 * outbound call to the Atlassian MCP API, so it isn't made unconditionally. A
 * gated route can also set `options.app.atlassianLinkReason` - a short phrase
 * describing what the user was trying to do (e.g. "request a space") - for the
 * linking page to explain why they landed there.
 *
 * A connected request is decorated with `request.app.atlassianConnected` (true)
 * and allowed through. A request that isn't connected - including one with
 * no authenticated user - has its path and reason stashed in the session,
 * and is redirected to the linking page, which reads the stash back to
 * explain why they landed there. The route handler never runs. Doing this
 * here, once, rather than in every gated controller, keeps it in one place
 * as more routes opt in.
 *
 * Registered as `onPreHandler`, which runs after authentication, so
 * `request.auth.credentials` is already populated where present.
 */
const atlassianConnection = {
  plugin: {
    name: 'atlassianConnection',
    register (server) {
      server.ext('onPreHandler', async (request, h) => {
        const { requiresAtlassianLink, atlassianLinkReason } = request.route.settings.app ?? {}

        if (!requiresAtlassianLink) {
          return h.continue
        }

        if (!request.auth.isAuthenticated) {
          return h.redirect('/').takeover()
        }

        const userId = request.auth.credentials.profile.email
        const connected = Boolean(userId) && await isAtlassianLinked(userId)

        request.app.atlassianConnected = connected

        if (connected) {
          return h.continue
        }

        request.yar.set(ATLASSIAN_LINK_REQUIRED_SESSION_KEY, {
          returnTo: request.path,
          reason: atlassianLinkReason ?? DEFAULT_ATLASSIAN_LINK_REASON
        })

        return h.redirect('/account/atlassian-linking').takeover()
      })
    }
  }
}

export {
  atlassianConnection
}
