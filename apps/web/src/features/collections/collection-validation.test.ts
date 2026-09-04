import {
  MAX_COLLECTION_NAME_LENGTH,
  validateCollectionName,
  validateDeletionConfirmation,
} from './collection-validation'

describe('collection validation', () => {
  describe('validateCollectionName', () => {
    it('trims and accepts a valid name', () => {
      expect(validateCollectionName('  Travel  ')).toEqual({
        error: null,
        value: 'Travel',
      })
    })

    it('rejects empty and non-string values', () => {
      expect(validateCollectionName('   ').error).toBe(
        'Enter a collection name.'
      )
      expect(validateCollectionName(null).error).toBe(
        'Enter a collection name.'
      )
    })

    it('rejects names longer than the limit', () => {
      const result = validateCollectionName(
        'a'.repeat(MAX_COLLECTION_NAME_LENGTH + 1)
      )

      expect(result.error).toBe(
        `Use ${MAX_COLLECTION_NAME_LENGTH} characters or fewer.`
      )
    })

    it('accepts a name exactly at the length limit', () => {
      const name = 'a'.repeat(MAX_COLLECTION_NAME_LENGTH)

      expect(validateCollectionName(name)).toEqual({ error: null, value: name })
    })
  })

  describe('validateDeletionConfirmation', () => {
    it('requires an exact collection name after trimming', () => {
      expect(validateDeletionConfirmation('  Travel  ', 'Travel')).toBeNull()
      expect(validateDeletionConfirmation('travel', 'Travel')).toBe(
        'The collection name does not match.'
      )
    })

    it('rejects empty confirmation', () => {
      expect(validateDeletionConfirmation('', 'Travel')).toBe(
        'Enter the collection name to confirm deletion.'
      )
      expect(validateDeletionConfirmation(null, 'Travel')).toBe(
        'Enter the collection name to confirm deletion.'
      )
    })
  })
})
