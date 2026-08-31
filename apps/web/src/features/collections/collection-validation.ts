export const MAX_COLLECTION_NAME_LENGTH = 50

export interface CollectionNameValidation {
  error: string | null
  value: string
}

export const validateCollectionName = (
  input: FormDataEntryValue | null
): CollectionNameValidation => {
  const value = typeof input === 'string' ? input.trim() : ''

  if (!value) {
    return { error: 'Enter a collection name.', value }
  }

  if (value.length > MAX_COLLECTION_NAME_LENGTH) {
    return {
      error: `Use ${MAX_COLLECTION_NAME_LENGTH} characters or fewer.`,
      value,
    }
  }

  return { error: null, value }
}

export const validateDeletionConfirmation = (
  input: FormDataEntryValue | null,
  collectionName: string
) => {
  const confirmation = typeof input === 'string' ? input.trim() : ''

  if (!confirmation) {
    return 'Enter the collection name to confirm deletion.'
  }

  if (confirmation !== collectionName) {
    return 'The collection name does not match.'
  }

  return null
}
