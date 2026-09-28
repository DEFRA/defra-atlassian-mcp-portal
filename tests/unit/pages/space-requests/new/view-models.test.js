import * as viewModels from '../../../../../src/pages/space-requests/new/view-models.js'
import { products } from '../../../../../src/constants/products.js'
import { spaceStatuses } from '../../../../../src/constants/space-statuses.js'
import { productDecision, productNotRequested } from '../../../../fixtures/atlassian-mcp.js'

describe('ApprovalRequestViewModel', () => {
  const data = {
    id: 'req-1',
    spaceKey: 'FARM',
    iao: 'Jane Smith',
    email: 'test@example.com',
    products: {
      [products.JIRA]: productDecision({ status: spaceStatuses.APPROVED }),
      [products.CONFLUENCE]: productDecision({ status: spaceStatuses.PENDING })
    },
    submittedAt: '2024-01-01T00:00:00.000Z'
  }

  test('constructor maps all fields from the provided data', () => {
    const viewModel = new viewModels.ApprovalRequestViewModel({ ...data, status: 'pending' })

    expect(viewModel).toMatchObject(data)
  })

  test('fromResponse builds a view model from API response data', () => {
    const viewModel = viewModels.ApprovalRequestViewModel.fromResponse(data)

    expect(viewModel).toBeInstanceOf(viewModels.ApprovalRequestViewModel)
    expect(viewModel).toMatchObject(data)
  })

  test('fromResponse derives the status rather than reading one off the wire', () => {
    const viewModel = viewModels.ApprovalRequestViewModel.fromResponse({
      ...data,
      products: {
        [products.JIRA]: productDecision({ status: spaceStatuses.APPROVED }),
        [products.CONFLUENCE]: productDecision({ status: spaceStatuses.REJECTED })
      }
    })

    expect(viewModel.status).toBe(spaceStatuses.PARTIALLY_APPROVED)
  })
})

describe('SpaceRequestFormViewModel', () => {
  test('constructor initializes with provided values', () => {
    const data = {
      spaceKey: 'FARM',
      iao: 'jane@defra.gov.uk',
      reason: 'Need this space for a workshop',
      products: [products.JIRA],
      errors: { iao: { text: 'Invalid email' } },
      errorList: [{ text: 'Invalid email', href: '#iao' }]
    }

    const viewModel = new viewModels.SpaceRequestFormViewModel(data)

    expect(viewModel.spaceKey).toBe('FARM')
    expect(viewModel.iao).toBe('jane@defra.gov.uk')
    expect(viewModel.reason).toBe('Need this space for a workshop')
    expect(viewModel.products).toEqual([products.JIRA])
    expect(viewModel.errors).toEqual({ iao: { text: 'Invalid email' } })
    expect(viewModel.errorList).toEqual([{ text: 'Invalid email', href: '#iao' }])
  })

  test('constructor defaults reason to null when not provided', () => {
    const viewModel = new viewModels.SpaceRequestFormViewModel({ spaceKey: 'FARM', iao: 'jane@defra.gov.uk' })

    expect(viewModel.reason).toBeNull()
  })

  test('empty() creates a blank form instance', () => {
    const viewModel = viewModels.SpaceRequestFormViewModel.empty()

    expect(viewModel.spaceKey).toBe(null)
    expect(viewModel.iao).toBe(null)
    expect(viewModel.reason).toBe(null)
    expect(viewModel.products).toEqual([])
    expect(viewModel.errors).toBe(null)
    expect(viewModel.errorList).toBe(null)
  })

  describe('productItems', () => {
    test('offers every product, labelled, in a fixed order', () => {
      const viewModel = viewModels.SpaceRequestFormViewModel.empty()

      expect(viewModel.productItems.map((item) => item.value))
        .toEqual([products.JIRA, products.CONFLUENCE])
      expect(viewModel.productItems.map((item) => item.text))
        .toEqual(['Jira', 'Confluence'])
    })

    test('ticks nothing on a blank form', () => {
      const viewModel = viewModels.SpaceRequestFormViewModel.empty()

      expect(viewModel.productItems.every((item) => item.checked === false)).toBe(true)
    })

    test('re-ticks what was submitted, so a validation failure does not clear the boxes', () => {
      const viewModel = new viewModels.SpaceRequestFormViewModel({ products: [products.CONFLUENCE] })

      expect(viewModel.productItems.find((item) => item.value === products.JIRA).checked).toBe(false)
      expect(viewModel.productItems.find((item) => item.value === products.CONFLUENCE).checked).toBe(true)
    })

    test('treats a single ticked box - which posts a bare string - as a list', () => {
      const viewModel = new viewModels.SpaceRequestFormViewModel({ products: products.JIRA })

      expect(viewModel.products).toEqual([products.JIRA])
      expect(viewModel.productItems.find((item) => item.value === products.JIRA).checked).toBe(true)
    })
  })

  test('fromValidationError() extracts Joi errors into structured errors and errorList', () => {
    const payload = {
      spaceKey: 'FARM',
      iao: 'invalid-email',
      reason: 'short'
    }

    const err = {
      details: [
        { path: ['spaceKey'], message: 'Enter a space key' },
        { path: ['products'], message: 'Select which products you need access to' },
        { path: ['iao'], message: 'Enter a valid email address' },
        { path: ['reason'], message: 'Reason must be at least 10 characters' }
      ]
    }

    const viewModel = viewModels.SpaceRequestFormViewModel.fromValidationError(payload, err)

    expect(viewModel.spaceKey).toBe('FARM')
    expect(viewModel.iao).toBe('invalid-email')
    expect(viewModel.reason).toBe('short')
    expect(viewModel.errors).toEqual({
      spaceKey: { text: 'Enter a space key' },
      products: { text: 'Select which products you need access to' },
      iao: { text: 'Enter a valid email address' },
      reason: { text: 'Reason must be at least 10 characters' }
    })
    expect(viewModel.errorList).toEqual([
      { text: 'Enter a space key', href: '#spaceKey' },
      { text: 'Select which products you need access to', href: '#products' },
      { text: 'Enter a valid email address', href: '#iao' },
      { text: 'Reason must be at least 10 characters', href: '#reason' }
    ])
  })

  test('fromValidationError() reports a checkbox group once, not once per bad item', () => {
    const err = {
      details: [
        { path: ['products', 0], message: 'Select which products you need access to' },
        { path: ['products', 1], message: 'Select which products you need access to' }
      ]
    }

    const viewModel = viewModels.SpaceRequestFormViewModel.fromValidationError({}, err)

    expect(viewModel.errorList).toHaveLength(1)
  })

  test('fromValidationError() preserves payload values even with validation errors', () => {
    const payload = {
      spaceKey: 'FARM',
      iao: 'invalid-email',
      reason: 'Need this space for a workshop',
      products: [products.JIRA]
    }

    const err = {
      details: [
        { path: ['iao'], message: 'Enter a valid email address' }
      ]
    }

    const viewModel = viewModels.SpaceRequestFormViewModel.fromValidationError(payload, err)

    expect(viewModel.spaceKey).toBe('FARM')
    expect(viewModel.iao).toBe('invalid-email')
    expect(viewModel.reason).toBe('Need this space for a workshop')
    expect(viewModel.products).toEqual([products.JIRA])
  })
})

// Kept here rather than in the fixtures file: it only documents that the
// not-requested fixture is distinguishable from a pending one, which is what
// the form model relies on when it decides what to tick.
test('a not-requested product is not the same as a pending one', () => {
  expect(productNotRequested().requested).toBe(false)
  expect(productDecision().requested).toBe(true)
})
