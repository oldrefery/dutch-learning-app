import { record } from './protectedInput.ts'

export interface ProviderDiagnostics {
  http_status: number
  google_status: string | null
  body_state: 'structured' | 'unstructured' | 'unavailable'
  message: string
  field_violations: { field: string; message: string }[]
}

const STATUS_MESSAGES: Record<string, string> = {
  CANCELLED: 'Provider reported cancellation; processing outcome is uncertain.',
  UNKNOWN: 'Provider reported an unknown error.',
  INVALID_ARGUMENT: 'Provider rejected an invalid request argument.',
  DEADLINE_EXCEEDED:
    'Provider deadline exceeded; processing outcome is uncertain.',
  NOT_FOUND: 'Provider could not find the requested resource.',
  ALREADY_EXISTS: 'Provider reported a resource conflict.',
  PERMISSION_DENIED: 'Provider denied access to the requested resource.',
  RESOURCE_EXHAUSTED: 'Provider reported exhausted quota or capacity.',
  FAILED_PRECONDITION: 'Provider reported an unmet request precondition.',
  ABORTED: 'Provider reported an aborted operation.',
  OUT_OF_RANGE: 'Provider rejected an out-of-range argument.',
  UNIMPLEMENTED: 'Provider does not implement the requested operation.',
  INTERNAL:
    'Provider reported an internal error; processing outcome is uncertain.',
  UNAVAILABLE: 'Provider is unavailable; processing outcome is uncertain.',
  DATA_LOSS: 'Provider reported data loss; processing outcome is uncertain.',
  UNAUTHENTICATED: 'Provider rejected authentication credentials.',
}
const HTTP_MESSAGES: Record<number, string> = {
  400: STATUS_MESSAGES.INVALID_ARGUMENT,
  401: STATUS_MESSAGES.UNAUTHENTICATED,
  403: STATUS_MESSAGES.PERMISSION_DENIED,
  404: STATUS_MESSAGES.NOT_FOUND,
  408: STATUS_MESSAGES.DEADLINE_EXCEEDED,
  429: STATUS_MESSAGES.RESOURCE_EXHAUSTED,
}
const KNOWN_FIELDS = new Set([
  'model',
  'contents',
  'contents[].role',
  'contents[].parts',
  'contents[].parts[].text',
  'systemInstruction',
  'systemInstruction.parts[].text',
  'generationConfig',
  'generationConfig.candidateCount',
  'generationConfig.maxOutputTokens',
  'generationConfig.responseFormat',
  'generationConfig.responseFormat.text',
  'generationConfig.responseFormat.text.mimeType',
  'generationConfig.responseFormat.text.schema',
])
const safeField = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > 160) return null
  const field = value
    .replace(/\[\d{1,3}\]/g, '[]')
    .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  return KNOWN_FIELDS.has(field) ? field : null
}

// Operator-only projection. Never retain provider prose, descriptions, arbitrary
// paths, headers or raw bodies: any of them may echo credentials/private input.
// Messages are synthesized from allowlisted codes, not truncated raw error text.
export const providerDiagnostics = (
  httpStatus: number,
  body: string | null
): ProviderDiagnostics => {
  let error: Record<string, unknown> = {}
  try {
    if (body !== null) error = record(record(JSON.parse(body)).error)
  } catch {
    // Malformed/unstructured bodies still provide useful HTTP diagnostics.
  }
  const status =
    typeof error.status === 'string' &&
    Object.hasOwn(STATUS_MESSAGES, error.status)
      ? error.status
      : null
  const fields = new Set<string>()
  const add = (value: unknown) => {
    const field = safeField(value)
    if (field && fields.size < 8) fields.add(field)
  }
  if (Array.isArray(error.details)) {
    for (const detail of error.details.slice(0, 8)) {
      try {
        const row = record(detail)
        if (
          row['@type'] === 'type.googleapis.com/google.rpc.BadRequest' &&
          Array.isArray(row.fieldViolations)
        )
          for (const violation of row.fieldViolations.slice(0, 8)) {
            try {
              add(record(violation).field)
            } catch {
              // Untrusted detail entries do not invalidate safe status evidence.
            }
          }
      } catch {
        // Ignore unrecognized detail shapes without retaining their contents.
      }
    }
  }
  if (typeof error.message === 'string')
    for (const match of error.message.matchAll(
      /Invalid value at '([^']{1,160})'/g
    ))
      add(match[1])
  return {
    http_status: httpStatus,
    google_status: status,
    body_state:
      body === null
        ? 'unavailable'
        : Object.keys(error).length
          ? 'structured'
          : 'unstructured',
    message:
      (status && STATUS_MESSAGES[status]) ||
      HTTP_MESSAGES[httpStatus] ||
      'Provider returned an unsuccessful HTTP response; processing outcome is uncertain.',
    field_violations: [...fields].map(field => ({
      field,
      message: 'Provider reported an invalid field value.',
    })),
  }
}
