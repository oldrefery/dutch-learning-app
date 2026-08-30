export interface DeleteAccountResponse {
  error: string | null
  success: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseDeleteAccountResponse = (
  value: unknown
): DeleteAccountResponse => {
  if (!isRecord(value) || value.success !== true) {
    return {
      success: false,
      error:
        isRecord(value) && typeof value.error === 'string'
          ? value.error
          : 'Account deletion failed.',
    }
  }

  return { success: true, error: null }
}
