/**
 * The three states the Atlassian connection row can be in, as a ready-to-render
 * summary-list value.
 */
const CONNECTION_STATES = {
  error: {
    tagText: 'Unavailable',
    tagClasses: 'govuk-tag--grey',
    hint: 'We couldn\'t check your Atlassian connection status. Try again later.',
    actionText: null,
    actionHref: null
  },
  linked: {
    tagText: 'Connected',
    tagClasses: 'govuk-tag--green',
    hint: null,
    actionText: 'Manage your Atlassian connection',
    actionHref: '/account/atlassian-linking'
  },
  notLinked: {
    tagText: 'Not connected',
    tagClasses: 'govuk-tag--grey',
    hint: 'Connect your Atlassian account so the MCP server can read Jira and Confluence as you.',
    actionText: 'Connect your Atlassian account',
    actionHref: '/account/atlassian-linking'
  }
}

class DashboardViewModel {
  constructor (data = {}) {
    this.atlassianStatusError = data.atlassianStatusError ?? false
    this.atlassianLinked = data.atlassianLinked ?? false
    this.connection = data.connection ?? CONNECTION_STATES.notLinked
    this.reviewCount = data.reviewCount ?? 0
  }

  /**
   * Build the view model from the linking service's status result.
   *
   * @param {{linkingStatus: object|null, statusError: boolean, authorizationUrl: string|null}} status
   * @returns {DashboardViewModel}
   */
  static fromLinkingStatus (status) {
    if (status.statusError) {
      return new DashboardViewModel({
        atlassianStatusError: true,
        connection: CONNECTION_STATES.error
      })
    }

    const linked = status.linkingStatus.linked

    return new DashboardViewModel({
      atlassianLinked: linked,
      connection: linked ? CONNECTION_STATES.linked : CONNECTION_STATES.notLinked
    })
  }
}

export {
  DashboardViewModel
}
