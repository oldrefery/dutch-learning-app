const REDACTED_VALUE = '[REDACTED]'
const ACCESSOR_VALUE = '[Accessor]'
const CIRCULAR_VALUE = '[Circular]'
const INVALID_DATE_VALUE = '[Invalid Date]'
const TRUNCATED_VALUE = '[Truncated]'
const UNSERIALIZABLE_VALUE = '[Unserializable]'
const MAX_SANITIZE_DEPTH = 6
const MAX_SANITIZED_STRING_LENGTH = 4096

const SENSITIVE_KEY_NAMES = new Set([
  'authorization',
  'proxyauthorization',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'identitytoken',
  'token',
  'password',
  'passwordconfirmation',
  'passwordhash',
  'passwd',
  'pwd',
  'email',
  'userid',
  'cookie',
  'setcookie',
  'jwt',
  'secret',
  'clientsecret',
  'credential',
  'credentials',
  'sessionid',
])

const SENSITIVE_KEY_SUFFIXES = [
  'token',
  'password',
  'secret',
  'credential',
  'cookie',
  'email',
  'userid',
]

const SENSITIVE_PARAM_PATTERN =
  /(^|[?#&\s])((?:authorization|proxy_authorization|api_?key|access_token|refresh_token|id_token|identity_token|token|password|email|userId|user_id|cookie|jwt|secret|client_secret|credential|credentials|session_id)=)[^&#\s]+/gi
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(authorization|proxy[-_]?authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|identity[-_]?token|token|password|email|user[-_]?id|cookie|jwt|secret|client[-_]?secret|credentials?|session[-_]?id)\s*([:=])\s*(?:"[^"]*"|'[^']*'|[^,;&\s}]+)/gi
const SENSITIVE_HEADER_PATTERN =
  /\b(authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n,]+/gi
const BEARER_TOKEN_PATTERN = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g
const EMAIL_ADDRESS_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const LOG_CONTROL_CHARS_PATTERN = /[\r\n\t]+/g

const normalizeKey = (key: string): string =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '')

const isSensitiveKey = (key: string): boolean => {
  const normalizedKey = normalizeKey(key)
  return (
    SENSITIVE_KEY_NAMES.has(normalizedKey) ||
    SENSITIVE_KEY_SUFFIXES.some(suffix => normalizedKey.endsWith(suffix))
  )
}

const truncateString = (value: string): string =>
  value.length > MAX_SANITIZED_STRING_LENGTH
    ? `${value.slice(0, MAX_SANITIZED_STRING_LENGTH)}${TRUNCATED_VALUE}`
    : value

const sanitizeString = (value: string): string =>
  truncateString(
    value
      .replace(
        SENSITIVE_HEADER_PATTERN,
        (_match, headerName: string) => `${headerName}: ${REDACTED_VALUE}`
      )
      .replace(BEARER_TOKEN_PATTERN, `$1${REDACTED_VALUE}`)
      .replace(SENSITIVE_PARAM_PATTERN, `$1$2${REDACTED_VALUE}`)
      .replace(
        SENSITIVE_ASSIGNMENT_PATTERN,
        (_match, key: string, separator: string) =>
          `${key}${separator === ':' ? ': ' : '='}${REDACTED_VALUE}`
      )
      .replace(JWT_PATTERN, REDACTED_VALUE)
      .replace(EMAIL_ADDRESS_PATTERN, REDACTED_VALUE)
      .replace(LOG_CONTROL_CHARS_PATTERN, ' ')
  )

function sanitizeArray(
  value: unknown[],
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (seen.has(value)) {
    return CIRCULAR_VALUE
  }

  seen.add(value)
  try {
    return Array.from({ length: value.length }, (_item, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor) {
        return undefined
      }

      return 'value' in descriptor
        ? sanitizeUnknown(descriptor.value, depth + 1, seen)
        : ACCESSOR_VALUE
    })
  } finally {
    seen.delete(value)
  }
}

function sanitizeRecord(
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (seen.has(value)) {
    return CIRCULAR_VALUE
  }

  seen.add(value)

  try {
    const descriptors = Object.getOwnPropertyDescriptors(value)
    return Object.fromEntries(
      Object.entries(descriptors)
        .filter(([, descriptor]) => descriptor.enumerable)
        .map(([key, descriptor]) => [
          sanitizeString(key),
          isSensitiveKey(key)
            ? REDACTED_VALUE
            : 'value' in descriptor
              ? sanitizeUnknown(descriptor.value, depth + 1, seen)
              : ACCESSOR_VALUE,
        ])
    )
  } finally {
    seen.delete(value)
  }
}

const sanitizeValue = (
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
    return TRUNCATED_VALUE
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? INVALID_DATE_VALUE
      : value.toISOString()
  }

  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    }
  }

  if (Array.isArray(value)) {
    return sanitizeArray(value, depth, seen)
  }

  return sanitizeRecord(value as Record<string, unknown>, depth, seen)
}

const sanitizeUnknown = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown => {
  try {
    return sanitizeValue(value, depth, seen)
  } catch {
    return UNSERIALIZABLE_VALUE
  }
}

export function sanitizeLogContext<T>(context: T): T {
  return sanitizeUnknown(context, 0, new WeakSet<object>()) as T
}

export function sanitizeLogMessage(message: string): string {
  return sanitizeString(message)
}

export { REDACTED_VALUE }
