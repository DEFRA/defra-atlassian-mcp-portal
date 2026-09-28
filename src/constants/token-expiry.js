/**
 * How long a new personal access token can be asked to last.
 *
 * One module owns both the radio items and the accepted values so the form and
 * its validation cannot drift - `pages/account/tokens/schemas.js` builds its
 * `Joi.valid(...)` list from `tokenExpiryValues` rather than repeating the
 * numbers.
 *
 * The set is bounded by upstream: `atlassian-mcp`'s `PersonalTokenService.mint`
 * clamps `ttl_days` to `IDENTITY_MAX_TTL_DAYS` (365) and falls back to
 * `IDENTITY_DEFAULT_TTL_DAYS` (90) when it is absent. There is deliberately no
 * "never expires" option - upstream has no way to express one, and offering it
 * would silently give the user a 90-day token instead.
 */

const tokenExpiryOptions = [
  { value: 30, text: '30 days' },
  { value: 90, text: '90 days' },
  { value: 180, text: '180 days' },
  { value: 365, text: '365 days' }
]

/**
 * Pre-selected on the generate form. Matches upstream's own default, so the
 * portal is not quietly imposing a different policy from the API.
 */
const defaultTokenExpiryDays = 90

const tokenExpiryValues = tokenExpiryOptions.map((option) => option.value)

export {
  tokenExpiryOptions,
  tokenExpiryValues,
  defaultTokenExpiryDays
}
