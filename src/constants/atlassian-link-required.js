/**
 * Session key the `atlassianConnection` server plugin stores a gated request's
 * context under - where to send the user back to, and why they were
 * stopped - when it redirects them to the linking page instead of letting
 * the request through.
 *
 * The linking page controller reads this back to explain why the user landed
 * there, and the OAuth callback controller reads it to send a successful link
 * back to the original destination rather than to the linking page.
 */
const ATLASSIAN_LINK_REQUIRED_SESSION_KEY = 'atlassianLinkRequired'

/**
 * Fallback reason shown on the linking page when a route opts into
 * `requiresAtlassianLink` without giving its own `atlassianLinkReason` text.
 */
const DEFAULT_ATLASSIAN_LINK_REASON = 'do that'

export {
  ATLASSIAN_LINK_REQUIRED_SESSION_KEY,
  DEFAULT_ATLASSIAN_LINK_REASON
}
