import Joi from 'joi'

import { products } from '../../../constants/products.js'

const MIN_REASON_LENGTH = 10
const MAX_REASON_LENGTH = 255

const spaceRequestSchema = Joi.object({
  spaceKey: Joi.string().trim().required().messages({
    'string.empty': 'Enter a space key',
    'any.required': 'Enter a space key'
  }),
  // `.single()` because a checkbox group with one box ticked posts a bare
  // string, not an array - without it, asking for Jira alone fails validation
  // while asking for both passes.
  products: Joi.array()
    .items(Joi.string().valid(...Object.values(products)))
    .single()
    .min(1)
    .required()
    .messages({
      'array.min': 'Select which products you need access to',
      'any.required': 'Select which products you need access to',
      'any.only': 'Select which products you need access to'
    }),
  iao: Joi.string().trim().email({ tlds: { allow: false } }).required()
    .custom((value, helpers) => {
      if (!value.toLowerCase().endsWith('@defra.gov.uk')) {
        return helpers.error('iao.domain')
      }

      return value
    })
    .messages({
      'string.empty': 'Enter an Information Asset Owner email address',
      'any.required': 'Enter an Information Asset Owner email address',
      'string.email': 'Enter a valid email address for the Information Asset Owner',
      'iao.domain': 'Information Asset Owner must be a defra.gov.uk email address'
    }),
  reason: Joi.string().trim().min(MIN_REASON_LENGTH).max(MAX_REASON_LENGTH).required().messages({
    'string.empty': 'Enter a reason for requesting this space',
    'string.min': `Reason must be at least ${MIN_REASON_LENGTH} characters`,
    'string.max': `Reason must be at most ${MAX_REASON_LENGTH} characters`,
    'any.required': 'Enter a reason for requesting this space'
  })
})

export {
  spaceRequestSchema
}
