import { spaceRequestSchema } from '../../../../../src/pages/space-requests/new/schemas.js'
import { products } from '../../../../../src/constants/products.js'

const validate = (payload) => spaceRequestSchema.validate(payload, { abortEarly: false })

const messages = (result) => result.error.details.map((detail) => detail.message)

const valid = {
  spaceKey: 'FARM',
  products: [products.JIRA, products.CONFLUENCE],
  iao: 'jane.smith@defra.gov.uk',
  reason: 'Reading team tickets and docs in Claude'
}

describe('spaceRequestSchema', () => {
  test('accepts a request for both products', () => {
    const { error, value } = validate(valid)

    expect(error).toBeUndefined()
    expect(value.products).toEqual([products.JIRA, products.CONFLUENCE])
  })

  describe('spaceKey', () => {
    test('trims surrounding whitespace', () => {
      const { value } = validate({ ...valid, spaceKey: '  FARM  ' })

      expect(value.spaceKey).toBe('FARM')
    })

    test.each([
      ['an empty key', ''],
      ['a key of only whitespace', '   ']
    ])('asks for one given %s', (_case, spaceKey) => {
      expect(messages(validate({ ...valid, spaceKey })))
        .toContain('Enter a space key')
    })

    test('asks for one when the field is missing entirely', () => {
      const { spaceKey, ...withoutKey } = valid

      expect(messages(validate(withoutKey))).toContain('Enter a space key')
    })
  })

  describe('products', () => {
    // A checkbox group with one box ticked posts a bare string rather than an
    // array. Without Joi's `.single()` that would fail validation, so asking
    // for Jira alone would be impossible while asking for both worked.
    test('accepts a single ticked box, which arrives as a bare string', () => {
      const { error, value } = validate({ ...valid, products: products.JIRA })

      expect(error).toBeUndefined()
      expect(value.products).toEqual([products.JIRA])
    })

    test('asks for a selection when the group is untouched and posts nothing', () => {
      const { products: _omitted, ...withoutProducts } = valid

      expect(messages(validate(withoutProducts)))
        .toContain('Select which products you need access to')
    })

    test('asks for a selection given an empty list', () => {
      expect(messages(validate({ ...valid, products: [] })))
        .toContain('Select which products you need access to')
    })

    test('rejects a product this service does not know about', () => {
      expect(messages(validate({ ...valid, products: ['bitbucket'] })))
        .toContain('Select which products you need access to')
    })
  })

  describe('iao', () => {
    test('rejects an address outside defra.gov.uk', () => {
      expect(messages(validate({ ...valid, iao: 'jane@example.com' })))
        .toContain('Information Asset Owner must be a defra.gov.uk email address')
    })

    test('accepts a defra.gov.uk address whatever its case', () => {
      const { error } = validate({ ...valid, iao: 'Jane.Smith@Defra.Gov.UK' })

      expect(error).toBeUndefined()
    })

    test('asks for one when it is missing', () => {
      const { iao: _omitted, ...withoutIao } = valid

      expect(messages(validate(withoutIao)))
        .toContain('Enter an Information Asset Owner email address')
    })
  })

  describe('reason', () => {
    test('rejects a reason too short to tell the reviewer anything', () => {
      expect(messages(validate({ ...valid, reason: 'short' })))
        .toContain('Reason must be at least 10 characters')
    })

    test('rejects a reason longer than the form allows', () => {
      expect(messages(validate({ ...valid, reason: 'x'.repeat(256) })))
        .toContain('Reason must be at most 255 characters')
    })

    test('asks for one when it is missing', () => {
      const { reason: _omitted, ...withoutReason } = valid

      expect(messages(validate(withoutReason)))
        .toContain('Enter a reason for requesting this space')
    })
  })
})
