import { tokenStatuses } from '../../../../../src/constants/token-statuses.js'
import {
  TokenListViewModel,
  MintTokenFormViewModel,
  CreatedTokenViewModel,
  RevokeTokenViewModel
} from '../../../../../src/pages/account/tokens/view-model.js'

const token = (overrides = {}) => ({
  id: 'pat_1',
  label: 'Claude Code',
  prefix: 'amcp_xJ8v3kQz',
  createdAt: '2026-08-30T10:15:30.000Z',
  expiresAt: '2026-11-28T10:15:30.000Z',
  lastUsedAt: null,
  revokedAt: null,
  status: tokenStatuses.ACTIVE,
  ...overrides
})

describe('TokenListViewModel', () => {
  test('formats every date the GOV.UK way', () => {
    const model = TokenListViewModel.fromTokens({
      tokens: [token({ lastUsedAt: '2026-09-01T08:00:00.000Z' })],
      listError: false
    })

    expect(model.tokens[0]).toMatchObject({
      createdOn: '30 August 2026 10:15 AM',
      lastUsed: '1 September 2026 08:00 AM',
      expiresOn: '28 November 2026 10:15 AM'
    })
  })

  test('says a token has never been used rather than leaving the cell blank', () => {
    const model = TokenListViewModel.fromTokens({ tokens: [token()], listError: false })

    expect(model.tokens[0].lastUsed).toBe('Never used')
  })

  test('offers revocation for an active token', () => {
    const model = TokenListViewModel.fromTokens({ tokens: [token()], listError: false })

    expect(model.tokens[0].canRevoke).toBe(true)
  })

  test.each([
    [tokenStatuses.REVOKED],
    [tokenStatuses.EXPIRED]
  ])('does not offer revocation for a %s token, which upstream would answer 404', (status) => {
    const model = TokenListViewModel.fromTokens({ tokens: [token({ status })], listError: false })

    expect(model.tokens[0].canRevoke).toBe(false)
  })

  test('carries the listing failure through so the page can distinguish it from having no tokens', () => {
    const model = TokenListViewModel.fromTokens({ tokens: [], listError: true })

    expect(model).toMatchObject({ tokens: [], listError: true })
  })

  test('treats the Atlassian connection as healthy unless told otherwise, so the warning is never shown on a guess', () => {
    const model = TokenListViewModel.fromTokens({ tokens: [], listError: false })

    expect(model.atlassianLinked).toBe(true)
  })
})

describe('MintTokenFormViewModel', () => {
  test('preselects the same 90-day expiry upstream defaults to', () => {
    const model = MintTokenFormViewModel.empty()

    expect(model.ttlDays).toBe(90)
    expect(model.expiryItems).toContainEqual({ value: '90', text: '90 days', checked: true })
  })

  test('offers exactly one selected expiry', () => {
    const model = MintTokenFormViewModel.empty()

    expect(model.expiryItems.filter((item) => item.checked)).toHaveLength(1)
  })

  test('keeps what the user typed when the submission is rejected', () => {
    const model = MintTokenFormViewModel.fromValidationError(
      { label: 'Claude Code', ttlDays: '30' },
      { details: [{ path: ['label'], message: 'Enter a name for this token' }] }
    )

    expect(model.label).toBe('Claude Code')
    expect(model.expiryItems).toContainEqual({ value: '30', text: '30 days', checked: true })
  })

  test('builds both the per-field message and the error summary entry', () => {
    const model = MintTokenFormViewModel.fromValidationError(
      { label: '', ttlDays: '90' },
      { details: [{ path: ['label'], message: 'Enter a name for this token' }] }
    )

    expect(model.errors).toEqual({ label: { text: 'Enter a name for this token' } })
    expect(model.errorList).toEqual([
      { text: 'Enter a name for this token', href: '#label' }
    ])
  })

  test('falls back to the default expiry when the submitted one was the invalid field', () => {
    const model = MintTokenFormViewModel.fromValidationError(
      { label: 'Claude Code', ttlDays: 'tomorrow' },
      { details: [{ path: ['ttlDays'], message: 'Select when this token should expire' }] }
    )

    expect(model.expiryItems.filter((item) => item.checked)).toHaveLength(1)
    expect(model.ttlDays).toBe(90)
  })
})

describe('CreatedTokenViewModel', () => {
  const minted = {
    id: 'pat_1',
    secret: 'amcp_secret',
    label: 'Claude Code',
    expiresAt: '2026-11-28T10:15:30.000Z'
  }

  test('builds a client configuration with the secret already in it', () => {
    const model = CreatedTokenViewModel.fromToken(minted, 'https://mcp.example.gov.uk')

    expect(JSON.parse(model.configSnippet)).toEqual({
      mcpServers: {
        atlassian: {
          url: 'https://mcp.example.gov.uk/mcp',
          headers: { Authorization: 'Bearer amcp_secret' }
        }
      }
    })
  })

  test('does not double the slash when the configured URL has a trailing one', () => {
    const model = CreatedTokenViewModel.fromToken(minted, 'https://mcp.example.gov.uk/')

    expect(JSON.parse(model.configSnippet).mcpServers.atlassian.url)
      .toBe('https://mcp.example.gov.uk/mcp')
  })

  test('omits the snippet when no public URL is configured, rather than naming a host that would fail', () => {
    const model = CreatedTokenViewModel.fromToken(minted, null)

    expect(model.configSnippet).toBeNull()
    expect(model.secret).toBe('amcp_secret')
  })

  test('formats the expiry date for reading', () => {
    const model = CreatedTokenViewModel.fromToken(minted, null)

    expect(model.expiresOn).toBe('28 November 2026')
  })
})

describe('RevokeTokenViewModel', () => {
  test('carries enough to tell one token from another before it is destroyed', () => {
    const model = RevokeTokenViewModel.fromToken(token())

    expect(model).toMatchObject({
      id: 'pat_1',
      label: 'Claude Code',
      prefix: 'amcp_xJ8v3kQz',
      createdOn: '30 August 2026',
      lastUsed: 'Never used'
    })
  })
})
