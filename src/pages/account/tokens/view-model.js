import { tokenExpiryOptions, defaultTokenExpiryDays } from '../../../constants/token-expiry.js'
import { tokenStatuses, tokenStatusDisplay } from '../../../constants/token-statuses.js'
import { formatDate, formatDateOnly } from '../../common/dates.js'

const TOKEN_COLUMNS = [
  { text: 'Name' },
  { text: 'Token' },
  { text: 'Status' },
  { text: 'Created' },
  { text: 'Last used' },
  { text: 'Expires' }
]

class TokenListViewModel {
  constructor (data = {}) {
    this.tokens = data.tokens ?? []
    this.listError = data.listError ?? false
    this.atlassianLinked = data.atlassianLinked ?? true
    this.revokedLabel = data.revokedLabel ?? null
    this.columns = TOKEN_COLUMNS
  }

  /**
   * @param {{tokens: object[], listError: boolean}} result - From `services/personal-tokens.js`
   * @param {{atlassianLinked: boolean, revokedLabel: string|null}} context
   * @returns {TokenListViewModel}
   */
  static fromTokens (result, context = {}) {
    return new TokenListViewModel({
      tokens: result.tokens.map(_toRow),
      listError: result.listError,
      atlassianLinked: context.atlassianLinked,
      revokedLabel: context.revokedLabel ?? null
    })
  }
}

/**
 * MintTokenFormViewModel - Form state for `/account/tokens/new`, in the shape
 * `space-requests/new`'s form model established: `errors` keyed by field for
 * the govuk components' `errorMessage`, and `errorList` for the error summary.
 */
class MintTokenFormViewModel {
  constructor (data = {}) {
    this.label = data.label ?? null
    this.ttlDays = data.ttlDays ?? defaultTokenExpiryDays
    this.errors = data.errors ?? null
    this.errorList = data.errorList ?? null
    this.expiryItems = _expiryItems(this.ttlDays)
  }

  static empty () {
    return new MintTokenFormViewModel()
  }

  /**
   * Rebuild the form from a rejected submission, preserving what the user
   * typed. `ttlDays` falls back to the default when the submitted value was
   * the thing that failed, so the radios always have exactly one selection.
   *
   * @param {object} payload - The submitted form body
   * @param {{details: object[]}} err - The Joi validation error
   * @returns {MintTokenFormViewModel}
   */
  static fromValidationError (payload, err) {
    const errors = {}
    const errorList = []

    for (const detail of err.details) {
      const field = detail.path[0]
      errors[field] = { text: detail.message }
      errorList.push({ text: detail.message, href: `#${field}` })
    }

    return new MintTokenFormViewModel({
      label: payload?.label,
      ttlDays: Number(payload?.ttlDays) || defaultTokenExpiryDays,
      errors,
      errorList
    })
  }
}

class CreatedTokenViewModel {
  constructor (data = {}) {
    this.label = data.label ?? null
    this.secret = data.secret ?? null
    this.expiresOn = data.expiresOn ?? null
    this.configSnippet = data.configSnippet ?? null
  }

  /**
   * @param {{label: string, secret: string, expiresAt: string}} token
   * @param {string|null} mcpUrl - `atlassianMcp.publicUrl`, as an MCP client reaches it
   * @returns {CreatedTokenViewModel}
   */
  static fromToken (token, mcpUrl) {
    return new CreatedTokenViewModel({
      label: token.label,
      secret: token.secret,
      expiresOn: formatDateOnly(token.expiresAt),
      configSnippet: mcpUrl ? _configSnippet(token.secret, mcpUrl) : null
    })
  }
}

/**
 * RevokeTokenViewModel - Display model for the revoke confirmation page.
 */
class RevokeTokenViewModel {
  constructor (data = {}) {
    this.id = data.id ?? null
    this.label = data.label ?? null
    this.prefix = data.prefix ?? null
    this.createdOn = data.createdOn ?? null
    this.lastUsed = data.lastUsed ?? null
  }

  /**
   * @param {object} token - A token summary from `services/personal-tokens.js`
   * @returns {RevokeTokenViewModel}
   */
  static fromToken (token) {
    return new RevokeTokenViewModel({
      id: token.id,
      label: token.label,
      prefix: token.prefix,
      createdOn: formatDateOnly(token.createdAt),
      lastUsed: formatDateOnly(token.lastUsedAt) ?? 'Never used'
    })
  }
}

/**
 * @private
 * One row of the listing. `canRevoke` is the only piece of logic in it: a
 * token that has already been revoked or has expired cannot be revoked again,
 * and offering the link would send the user to a confirmation page whose
 * submission upstream answers 404.
 */
function _toRow (token) {
  return {
    id: token.id,
    label: token.label,
    prefix: token.prefix,
    status: tokenStatusDisplay[token.status],
    createdOn: formatDate(token.createdAt),
    lastUsed: formatDate(token.lastUsedAt) ?? 'Never used',
    expiresOn: formatDate(token.expiresAt),
    canRevoke: token.status === tokenStatuses.ACTIVE
  }
}

/**
 * @private
 * Radio items for the expiry question, with the given value pre-selected.
 */
function _expiryItems (selected) {
  return tokenExpiryOptions.map((option) => ({
    value: String(option.value),
    text: option.text,
    checked: option.value === Number(selected)
  }))
}

/**
 * @private
 * A `mcpServers` entry for the client's configuration file. `atlassian-mcp`
 * mounts its MCP app at `/mcp`, and authenticates it with the same bearer token
 * this page has just issued.
 */
function _configSnippet (secret, mcpUrl) {
  const config = {
    mcpServers: {
      atlassian: {
        url: `${mcpUrl.replace(/\/+$/, '')}/mcp`,
        headers: { Authorization: `Bearer ${secret}` }
      }
    }
  }

  return JSON.stringify(config, null, 2)
}

export {
  TokenListViewModel,
  MintTokenFormViewModel,
  CreatedTokenViewModel,
  RevokeTokenViewModel
}
