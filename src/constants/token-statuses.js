const tokenStatuses = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  UNKNOWN: 'unknown'
}

const tokenStatusDisplay = {
  [tokenStatuses.ACTIVE]: { label: 'Active', tagClasses: 'govuk-tag--green' },
  [tokenStatuses.EXPIRED]: { label: 'Expired', tagClasses: 'govuk-tag--grey' },
  [tokenStatuses.REVOKED]: { label: 'Revoked', tagClasses: 'govuk-tag--red' },
  [tokenStatuses.UNKNOWN]: { label: 'Unknown', tagClasses: 'govuk-tag--grey' }
}

export {
  tokenStatuses,
  tokenStatusDisplay
}
