import { canonicalizeJson } from '../../../../packages/domain/src/shared-dictionary.ts'

export const requireValid: (
  condition: unknown,
  code: string
) => asserts condition = (condition, code) => {
  if (!condition) throw new Error(`Invalid calibration data: ${code}`)
}

export const record = (value: unknown): Record<string, unknown> => {
  requireValid(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    'object_required'
  )
  return value as Record<string, unknown>
}

export const text = (value: unknown): string => {
  requireValid(
    typeof value === 'string' &&
      value.trim().length > 0 &&
      value.length <= 2000,
    'text_required'
  )
  return value
}

export const nullableText = (value: unknown): string | null =>
  value === null ? null : text(value)

export const digest = (value: unknown): string => {
  requireValid(
    typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
    'sha256_required'
  )
  return value
}

export const unit = (value: unknown): number => {
  requireValid(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1,
    'unit_interval_required'
  )
  return value
}

export const count = (value: unknown): number => {
  requireValid(
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
    'positive_count_required'
  )
  return value
}

export const list = (value: unknown): unknown[] => {
  requireValid(
    Array.isArray(value) && value.length <= 10000,
    'bounded_array_required'
  )
  return value
}

export const strings = (value: unknown): string[] => {
  const result = list(value).map(text)
  requireValid(result.length === new Set(result).size, 'duplicate_values')
  return result
}

export const sha256 = async (value: string): Promise<string> => {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(bytes), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

export const objectDigest = (value: unknown): Promise<string> =>
  sha256(canonicalizeJson(value))
