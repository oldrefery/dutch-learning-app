const REDACTED_VALUE = '[REDACTED]'
const MAX_SANITIZE_DEPTH = 6

const SENSITIVE_KEY_MARKERS = [
  'authorization',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'token',
  'password',
  'email',
  'userid',
  'cookie',
]

const SENSITIVE_PARAM_PATTERN =
  /([?#&](?:authorization|apikey|access_token|refresh_token|token|password|email|userId|user_id|cookie)=)[^&#\s]+/gi
const BEARER_TOKEN_PATTERN = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi
const LOG_CONTROL_CHARS_PATTERN = /[\r\n\t]+/g

const normalizeKey = (key: string): string =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '')

const isSensitiveKey = (key: string): boolean => {
  const normalizedKey = normalizeKey(key)
  return SENSITIVE_KEY_MARKERS.some(marker => normalizedKey.includes(marker))
}

const sanitizeString = (value: string): string =>
  value
    .replace(LOG_CONTROL_CHARS_PATTERN, ' ')
    .replace(SENSITIVE_PARAM_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(BEARER_TOKEN_PATTERN, `$1${REDACTED_VALUE}`)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const sanitizeUnknown = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown => {
  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value
  }

  if (typeof value === 'bigint' || typeof value === 'symbol') {
    return String(value)
  }

  if (typeof value === 'function') {
    return '[Function]'
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return '[Truncated]'
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    }
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]'
    }

    seen.add(value)
    return value.map(item => sanitizeUnknown(item, depth + 1, seen))
  }

  if (!isRecord(value)) {
    return value
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  seen.add(value)

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      isSensitiveKey(key)
        ? REDACTED_VALUE
        : sanitizeUnknown(entryValue, depth + 1, seen),
    ])
  )
}

export function sanitizeLogContext<T>(context: T): T {
  return sanitizeUnknown(context, 0, new WeakSet<object>()) as T
}

export function sanitizeLogMessage(message: string): string {
  return sanitizeString(message)
}

export { REDACTED_VALUE }
