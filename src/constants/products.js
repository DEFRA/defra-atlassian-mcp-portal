/**
 * The Atlassian products a space can be approved for.
 *
 * A space is governed once but decided twice: the Information Asset Owner can
 * approve it for Jira and refuse it for Confluence, or the other way round. So
 * the product is a dimension of the approval rather than a property of the
 * space, and every layer - form, wire body, status derivation, display - reads
 * its vocabulary from here.
 */
const products = {
  JIRA: 'jira',
  CONFLUENCE: 'confluence'
}

/**
 * Labels and hints for each product. Kept beside the codes, in the same shape
 * as `spaceStatusDisplay`, so a template never has to translate a code itself.
 */
const productDisplay = {
  [products.JIRA]: {
    label: 'Jira',
    hint: 'Issues, boards and project data'
  },
  [products.CONFLUENCE]: {
    label: 'Confluence',
    hint: 'Pages and space content'
  }
}

/**
 * Fixed display order, so the request form, the confirmation page and any
 * status list all read Jira then Confluence rather than whatever order a
 * payload or an upstream response happened to use.
 */
const orderedProducts = [products.JIRA, products.CONFLUENCE]

export {
  products,
  productDisplay,
  orderedProducts
}
