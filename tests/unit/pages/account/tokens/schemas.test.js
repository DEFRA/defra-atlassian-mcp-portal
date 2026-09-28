import {
  mintTokenSchema,
  revokeTokenSchema,
  MAX_LABEL_LENGTH
} from '../../../../../src/pages/account/tokens/schemas.js'

const validate = (schema, payload) => schema.validate(payload, { abortEarly: false })

const messages = (result) => result.error.details.map((detail) => detail.message)

describe('mintTokenSchema', () => {
  test('accepts a named token with an offered expiry', () => {
    const { error, value } = validate(mintTokenSchema, { label: 'Claude Code', ttlDays: '30' })

    expect(error).toBeUndefined()
    expect(value).toEqual({ label: 'Claude Code', ttlDays: 30 })
  })

  test('trims surrounding whitespace from the label', () => {
    const { value } = validate(mintTokenSchema, { label: '  Claude Code  ', ttlDays: '30' })

    expect(value.label).toBe('Claude Code')
  })

  test.each([
    ['an empty label', { label: '', ttlDays: '30' }],
    ['a label of only whitespace', { label: '   ', ttlDays: '30' }],
    ['a missing label', { ttlDays: '30' }]
  ])('asks for a name given %s', (_case, payload) => {
    expect(messages(validate(mintTokenSchema, payload)))
      .toContain('Enter a name for this token')
  })

  test('rejects a label longer than the listing can show', () => {
    const result = validate(mintTokenSchema, {
      label: 'x'.repeat(MAX_LABEL_LENGTH + 1),
      ttlDays: '30'
    })

    expect(messages(result)).toContain(`Token name must be ${MAX_LABEL_LENGTH} characters or fewer`)
  })

  test.each([
    ['a lifetime nobody was offered', '45'],
    ['a lifetime upstream would silently clamp to 365', '3650'],
    ['a value that is not a number at all', 'tomorrow']
  ])('refuses %s rather than letting it be reinterpreted upstream', (_case, ttlDays) => {
    expect(messages(validate(mintTokenSchema, { label: 'Claude Code', ttlDays })))
      .toContain('Select when this token should expire')
  })

  test('asks for an expiry when none was chosen', () => {
    expect(messages(validate(mintTokenSchema, { label: 'Claude Code' })))
      .toContain('Select when this token should expire')
  })
})

describe('revokeTokenSchema', () => {
  test('truncates an oversized label instead of failing, so a cosmetic field cannot block a revocation', () => {
    const { error, value } = validate(revokeTokenSchema, { label: 'x'.repeat(500) })

    expect(error).toBeUndefined()
    expect(value.label).toHaveLength(MAX_LABEL_LENGTH)
  })

  test('accepts a submission with no label at all', () => {
    expect(validate(revokeTokenSchema, {}).error).toBeUndefined()
  })
})
