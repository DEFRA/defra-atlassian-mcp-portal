import { orderedProducts, productDisplay } from '../../../constants/products.js'
import { deriveOverallStatus } from '../../../services/space-requests.js'

/**
 * ApprovalRequestViewModel - Display model for space request approvals
 * Used to present approval request data in views and responses
 */
class ApprovalRequestViewModel {
  constructor (data) {
    this.id = data.id
    this.spaceKey = data.spaceKey
    this.iao = data.iao
    this.email = data.email
    this.products = data.products
    this.status = data.status
    this.submittedAt = data.submittedAt
  }

  static fromResponse (responseData) {
    return new ApprovalRequestViewModel({
      id: responseData.id,
      spaceKey: responseData.spaceKey,
      iao: responseData.iao,
      email: responseData.email,
      products: responseData.products,
      status: deriveOverallStatus(responseData),
      submittedAt: responseData.submittedAt
    })
  }
}

/**
 * SpaceRequestFormViewModel - Encapsulates form state for the space request form
 * Handles both initial state and validation error states
 */
class SpaceRequestFormViewModel {
  constructor (data) {
    this.spaceKey = data?.spaceKey || null
    this.iao = data?.iao || null
    this.reason = data?.reason || null
    this.products = _asProductList(data?.products)
    this.productItems = _productItems(this.products)
    this.errors = data?.errors || null
    this.errorList = data?.errorList || null
  }

  /**
   * Create a form view model for the initial GET, optionally prefilled with a
   * space key carried over from the space page's "Request access" link.
   *
   * @param {string} [spaceKey]
   */
  static empty (spaceKey) {
    return new SpaceRequestFormViewModel({ spaceKey })
  }

  /**
   * Create a form view model from a validation error
   * Extracts Joi error details into structured errors and errorList
   */
  static fromValidationError (payload, err) {
    const errors = {}
    const errorList = []

    for (const detail of err.details) {
      const field = detail.path[0]

      // A per-item message on `products` reports its path as `products.0`.
      // Both anchor at the checkbox group, and reporting the same group twice
      // would put two identical lines in the error summary.
      if (errors[field]) {
        continue
      }

      errors[field] = { text: detail.message }
      errorList.push({ text: detail.message, href: `#${field}` })
    }

    return new SpaceRequestFormViewModel({
      spaceKey: payload.spaceKey,
      iao: payload.iao,
      reason: payload.reason,
      products: payload.products,
      errors,
      errorList
    })
  }
}

/**
 * @private
 * A checkbox group with one box ticked posts a bare string rather than an
 * array, and an untouched group posts nothing at all. Both have to come back
 * out of here as a list, so the template can ask `in` of it either way.
 */
function _asProductList (products) {
  if (Array.isArray(products)) {
    return products
  }

  return products ? [products] : []
}

/**
 * @private
 * The `govukCheckboxes` items, built from the product vocabulary rather than
 * written out in the template, so adding a third Atlassian product is a change
 * to `constants/products.js` alone.
 *
 * `checked` is driven by what was submitted so a validation failure re-renders
 * the user's ticks instead of silently clearing them.
 */
function _productItems (selected) {
  return orderedProducts.map((code) => ({
    value: code,
    text: productDisplay[code].label,
    hint: { text: productDisplay[code].hint },
    checked: selected.includes(code)
  }))
}

export {
  ApprovalRequestViewModel,
  SpaceRequestFormViewModel
}
