import { format, parseISO } from 'date-fns'

/**
 * GOV.UK date format - "21 August 2026 11:15 AM". Used wherever a stored ISO
 * timestamp is shown to a user with time detail, so every datetime in the
 * service reads the same way.
 *
 * Returns null rather than throwing or rendering "Invalid Date" for a missing
 * or unparseable value: a request that has not been decided yet has no
 * `decidedAt`, and the caller decides how to present that.
 *
 * @param {string|null|undefined} isoString
 * @returns {string|null}
 */
function formatDate (isoString) {
  if (!isoString) {
    return null
  }

  const parsed = parseISO(isoString)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return format(parsed, 'd MMMM yyyy hh:mm a')
}

/**
 * GOV.UK date-only format - "21 August 2026". Used for dates that should not
 * show a time component.
 *
 * Returns null rather than throwing or rendering "Invalid Date" for a missing
 * or unparseable value.
 *
 * @param {string|null|undefined} isoString
 * @returns {string|null}
 */
function formatDateOnly (isoString) {
  if (!isoString) {
    return null
  }

  const parsed = parseISO(isoString)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return format(parsed, 'd MMMM yyyy')
}

export {
  formatDate,
  formatDateOnly
}
