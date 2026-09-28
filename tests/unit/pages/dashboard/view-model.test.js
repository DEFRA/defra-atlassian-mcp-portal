import { DashboardViewModel } from '../../../../src/pages/dashboard/view-model.js'

describe('DashboardViewModel', () => {
  describe('constructor', () => {
    test('defaults every field when constructed with no data', () => {
      const viewModel = new DashboardViewModel()

      expect(viewModel).toMatchObject({
        atlassianStatusError: false,
        atlassianLinked: false
      })
    })
  })

  describe('fromLinkingStatus', () => {
    test('reflects a linked status when there is no status error', () => {
      const status = { statusError: false, linkingStatus: { linked: true }, authorizationUrl: null }

      const viewModel = DashboardViewModel.fromLinkingStatus(status)

      expect(viewModel).toMatchObject({
        atlassianStatusError: false,
        atlassianLinked: true
      })
    })

    test('reflects an unlinked status', () => {
      const status = { statusError: false, linkingStatus: { linked: false }, authorizationUrl: 'https://atlassian.example/authorize' }

      const viewModel = DashboardViewModel.fromLinkingStatus(status)

      expect(viewModel.atlassianLinked).toBe(false)
    })

    test('short-circuits to a status error without reading linkingStatus', () => {
      const status = { statusError: true, linkingStatus: null, authorizationUrl: null }

      const viewModel = DashboardViewModel.fromLinkingStatus(status)

      expect(viewModel).toMatchObject({
        atlassianStatusError: true,
        atlassianLinked: false
      })
    })
  })

  describe('connection', () => {
    test('offers a manage action and no hint when Atlassian is linked', () => {
      const viewModel = DashboardViewModel.fromLinkingStatus({
        statusError: false,
        linkingStatus: { linked: true }
      })

      expect(viewModel.connection).toMatchObject({
        tagText: 'Connected',
        tagClasses: 'govuk-tag--green',
        hint: null,
        actionHref: '/account/atlassian-linking'
      })
    })

    test('offers a connect action when Atlassian is not linked', () => {
      const viewModel = DashboardViewModel.fromLinkingStatus({
        statusError: false,
        linkingStatus: { linked: false }
      })

      expect(viewModel.connection).toMatchObject({
        tagText: 'Not connected',
        actionText: 'Connect your Atlassian account',
        actionHref: '/account/atlassian-linking'
      })
    })

    test('offers no action when the status check failed, since there is nothing useful to do', () => {
      const viewModel = DashboardViewModel.fromLinkingStatus({
        statusError: true,
        linkingStatus: null
      })

      expect(viewModel.connection).toMatchObject({
        tagText: 'Unavailable',
        actionHref: null
      })
    })
  })

  describe('reviewCount', () => {
    test('defaults to 0', () => {
      const viewModel = new DashboardViewModel()

      expect(viewModel.reviewCount).toBe(0)
    })

    test('accepts a provided reviewCount', () => {
      const viewModel = new DashboardViewModel({ reviewCount: 5 })

      expect(viewModel.reviewCount).toBe(5)
    })
  })
})
