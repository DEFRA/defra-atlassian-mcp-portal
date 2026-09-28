/**
 * Reasons an Atlassian connection test can fail, mapped from the HTTP status of
 * the test-connection response in `_mapTestFailureReason`
 * (`services/atlassian-linking.js`). Kept as fixed codes rather than ad-hoc
 * strings, the same way `connectionChecks` and `linkingOutcomes` are - and,
 * because they are internal codes rather than user-facing text, the linking
 * page view model is what turns them into something to show.
 */
const connectionFailureReasons = {
  UNAUTHORIZED: 'unauthorized',
  ATLASSIAN_API_ERROR: 'atlassian_api_error'
}

export {
  connectionFailureReasons
}
