import { orderedProducts, productDisplay } from '../../../../constants/products.js'
import { spaceStatuses } from '../../../../constants/space-statuses.js'

/**
 * SpaceRequestConfirmationViewModel - Display model for space request confirmation
 * Wraps session-stored space request data for rendering the confirmation page
 */
class SpaceRequestConfirmationViewModel {
  constructor ({ spaceKey, iao, email, products, status, submittedAt }) {
    this.spaceKey = spaceKey
    this.iao = iao
    this.email = email
    this.products = products
    this.status = status
    this.submittedAt = submittedAt
  }

  /**
   * Create a view model from session-stored space request
   */
  static fromSession (spaceRequest) {
    return new SpaceRequestConfirmationViewModel({
      spaceKey: spaceRequest.spaceKey,
      iao: spaceRequest.iao,
      email: spaceRequest.email,
      products: _productRows(spaceRequest.products),
      status: spaceRequest.status,
      submittedAt: spaceRequest.submittedAt
    })
  }
}

/**
 * @private
 * The rows `product-status-list.njk` renders: only the products actually asked
 * for, in the fixed display order, labelled rather than coded.
 *
 * Listing a product nobody requested would read as though the request covered
 * it and was refused, which is the opposite of what happened.
 */
function _productRows (products = {}) {
  return orderedProducts
    .filter((code) => products[code]?.requested)
    .map((code) => ({
      code,
      label: productDisplay[code].label,
      status: products[code].status ?? spaceStatuses.PENDING
    }))
}

export {
  SpaceRequestConfirmationViewModel
}
