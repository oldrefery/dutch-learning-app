import { FunctionsHttpError } from '@supabase/supabase-js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const readEdgeFunctionError = async (
  error: unknown,
  fallback: string
) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload: unknown = await error.context.json()
      if (isRecord(payload) && typeof payload.error === 'string') {
        return {
          message: payload.error,
          meta: payload.meta,
          status: error.context.status as number | undefined,
        }
      }
    } catch {
      return {
        message: fallback,
        status: error.context.status as number | undefined,
      }
    }
  }

  return {
    message: error instanceof Error && error.message ? error.message : fallback,
    status:
      error instanceof FunctionsHttpError
        ? (error.context.status as number | undefined)
        : undefined,
  }
}

export const getEdgeFunctionErrorMessage = async (
  error: unknown,
  fallback: string
) => (await readEdgeFunctionError(error, fallback)).message
