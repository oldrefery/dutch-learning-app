export class DictionaryImportConflictError extends Error {}

export function getImportErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message
  return String(error)
}
