import Joi from 'joi'

import { tokenExpiryValues } from '../../../constants/token-expiry.js'

const MAX_LABEL_LENGTH = 50

/**
 * The generate-a-token form.
 *
 * `label` is what upstream stores as the token's name. It is required here
 * even though `atlassian-mcp` would accept any non-empty string, because the label
 * is the only thing distinguishing one row of the listing from another - the
 * secret is gone and the prefix is eight random characters.
 *
 * `ttlDays` is constrained to `tokenExpiryValues` rather than a numeric range.
 * The form offers radios, so any other value is a hand-crafted request, and
 * upstream would silently clamp an out-of-range number to 365 days rather than
 * refuse it - a token quietly lasting longer than asked for is worth rejecting
 * outright.
 */
const mintTokenSchema = Joi.object({
  label: Joi.string().trim().max(MAX_LABEL_LENGTH).required().messages({
    'string.empty': 'Enter a name for this token',
    'any.required': 'Enter a name for this token',
    'string.max': `Token name must be ${MAX_LABEL_LENGTH} characters or fewer`
  }),
  ttlDays: Joi.number().valid(...tokenExpiryValues).required().messages({
    'number.base': 'Select when this token should expire',
    'any.only': 'Select when this token should expire',
    'any.required': 'Select when this token should expire'
  })
})

/**
 * The revoke confirmation form.
 *
 * `label` carries the token's name across the redirect purely so the listing's
 * banner can say which token went. It is optional and bounded rather than
 * trusted: it is echoed back to its own author in their own session, but a
 * hidden field is still user input and has no business being unbounded on its
 * way into the session store.
 *
 * `truncate()` rather than a rejection, which is why this route needs no
 * `failAction`: the schema cannot fail. Refusing to revoke a token because its
 * display name was too long would be the worst imaginable moment to be fussy,
 * and the name is only ever used to write one sentence back to the person who
 * submitted it.
 */
const revokeTokenSchema = Joi.object({
  label: Joi.string().trim().max(MAX_LABEL_LENGTH).truncate().allow('').optional()
})

export {
  mintTokenSchema,
  revokeTokenSchema,
  MAX_LABEL_LENGTH
}
