const spaceStatuses = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PARTIALLY_APPROVED: 'partially-approved',
  REJECTED: 'rejected',
  NOT_REQUESTED: 'not-requested'
}

const spaceStatusDisplay = {
  [spaceStatuses.PENDING]: { label: 'Pending', tagClasses: 'govuk-tag--yellow' },
  [spaceStatuses.APPROVED]: { label: 'Approved', tagClasses: 'govuk-tag--green' },
  [spaceStatuses.PARTIALLY_APPROVED]: { label: 'Partly approved', tagClasses: 'govuk-tag--blue' },
  [spaceStatuses.REJECTED]: { label: 'Rejected', tagClasses: 'govuk-tag--red' },
  [spaceStatuses.NOT_REQUESTED]: { label: 'Not requested', tagClasses: 'govuk-tag--grey' }
}

/**
 * Shown for a status the portal does not recognise - a value upstream has
 * added and this service has not caught up with. Better than rendering the raw
 * value, and better than rendering nothing at all.
 */
const unknownSpaceStatusDisplay = { label: 'Unknown', tagClasses: 'govuk-tag--grey' }

/**
 * The statuses a space request can actually be stored in, in workflow order.
 * Drives the spaces page filter, which is why it excludes `NOT_REQUESTED` -
 * there is nothing to filter for a space with no request behind it.
 *
 * `PARTIALLY_APPROVED` is never stored against a single product: it only ever
 * comes out of `deriveOverallStatus`, when one product was approved and the
 * other refused. It belongs here because it is a state a *request* can be
 * filtered by, even though no product ever carries it.
 */
const storedSpaceStatuses = [
  spaceStatuses.PENDING,
  spaceStatuses.APPROVED,
  spaceStatuses.PARTIALLY_APPROVED,
  spaceStatuses.REJECTED
]

export {
  spaceStatuses,
  spaceStatusDisplay,
  unknownSpaceStatusDisplay,
  storedSpaceStatuses
}
