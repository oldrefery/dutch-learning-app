import { FunctionsHttpError } from '@supabase/supabase-js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getEdgeFunctionErrorMessage = async (
  error: unknown,
  fallback: string
) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload: unknown = await error.context.json()
      if (isRecord(payload) && typeof payload.error === 'string') {
        return payload.error
      }
    } catch {
      return fallback
    }
  }

  return error instanceof Error && error.message ? error.message : fallback
}
