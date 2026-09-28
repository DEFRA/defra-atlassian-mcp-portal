import * as viewModels from '../../../../../../src/pages/space-requests/new/confirmation/view-models.js'
import { products } from '../../../../../../src/constants/products.js'
import { spaceStatuses } from '../../../../../../src/constants/space-statuses.js'
import { productDecision, productNotRequested } from '../../../../../fixtures/atlassian-mcp.js'

describe('SpaceRequestConfirmationViewModel', () => {
  const spaceRequest = {
    spaceKey: 'FARM',
    iao: 'jane.smith@defra.gov.uk',
    email: 'user@defra.gov.uk',
    products: {
      [products.JIRA]: productDecision(),
      [products.CONFLUENCE]: productDecision()
    },
    status: spaceStatuses.PENDING,
    submittedAt: '2024-01-01T00:00:00.000Z'
  }

  test('constructor maps all fields from the provided data', () => {
    const viewModel = new viewModels.SpaceRequestConfirmationViewModel(spaceRequest)

    expect(viewModel.spaceKey).toBe('FARM')
    expect(viewModel.iao).toBe('jane.smith@defra.gov.uk')
    expect(viewModel.email).toBe('user@defra.gov.uk')
    expect(viewModel.status).toBe(spaceStatuses.PENDING)
    expect(viewModel.submittedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  test('fromSession() builds a view model from session-stored space request', () => {
    const viewModel = viewModels.SpaceRequestConfirmationViewModel.fromSession(spaceRequest)

    expect(viewModel).toBeInstanceOf(viewModels.SpaceRequestConfirmationViewModel)
    expect(viewModel.spaceKey).toBe('FARM')
    expect(viewModel.iao).toBe('jane.smith@defra.gov.uk')
    expect(viewModel.email).toBe('user@defra.gov.uk')
    expect(viewModel.status).toBe(spaceStatuses.PENDING)
    expect(viewModel.submittedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  describe('product rows', () => {
    test('gives every requested product a labelled row of its own', () => {
      const viewModel = viewModels.SpaceRequestConfirmationViewModel.fromSession(spaceRequest)

      expect(viewModel.products).toEqual([
        { code: products.JIRA, label: 'Jira', status: spaceStatuses.PENDING },
        { code: products.CONFLUENCE, label: 'Confluence', status: spaceStatuses.PENDING }
      ])
    })

    test('leaves out a product nobody asked for, so it does not read as refused', () => {
      const viewModel = viewModels.SpaceRequestConfirmationViewModel.fromSession({
        ...spaceRequest,
        products: {
          [products.JIRA]: productDecision(),
          [products.CONFLUENCE]: productNotRequested()
        }
      })

      expect(viewModel.products.map((product) => product.code)).toEqual([products.JIRA])
    })

    test('carries each product its own status', () => {
      const viewModel = viewModels.SpaceRequestConfirmationViewModel.fromSession({
        ...spaceRequest,
        products: {
          [products.JIRA]: productDecision({ status: spaceStatuses.APPROVED }),
          [products.CONFLUENCE]: productDecision({ status: spaceStatuses.REJECTED })
        }
      })

      expect(viewModel.products.map((product) => product.status))
        .toEqual([spaceStatuses.APPROVED, spaceStatuses.REJECTED])
    })

    test('is empty rather than a crash when the session held no products', () => {
      const viewModel = viewModels.SpaceRequestConfirmationViewModel.fromSession({
        ...spaceRequest,
        products: undefined
      })

      expect(viewModel.products).toEqual([])
    })
  })
})
