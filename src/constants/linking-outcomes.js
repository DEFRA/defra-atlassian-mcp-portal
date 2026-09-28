/**
 * Discriminated outcomes for the Atlassian OAuth linking flow.
 * Used by the linking service and its consumers instead of raw string
 * literals, the same way `statusCodes` avoids magic HTTP status numbers.
 */
const linkingOutcomes = {
  SUCCESS: 'success',
  VALIDATION_FAILED: 'validation_failed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Session key the OAuth callback controller flashes an outcome under.
 * The linking page controller reads it back from the same key and is
 * solely responsible for turning the code into a displayable message -
 * the callback controller only ever stores the code.
 */
const LINKING_OUTCOME_SESSION_KEY = 'linkingOutcome'

export {
  linkingOutcomes,
  LINKING_OUTCOME_SESSION_KEY
}
