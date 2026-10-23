import { record } from './protectedInput.ts'

export const validObservedModelVersion = (value: unknown): value is string =>
  typeof value === 'string' && /^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(value)

// Requested aliases never establish the version that actually produced a result.
export const observedModelVersion = (
  result: Record<string, unknown>
): string | null => {
  try {
    const version = record(result.provider_response).modelVersion
    return validObservedModelVersion(version) ? version : null
  } catch {
    return null
  }
}

export const matchesObservedModel = (
  result: Record<string, unknown>,
  expected: string
): boolean =>
  validObservedModelVersion(expected) &&
  observedModelVersion(result) === expected
