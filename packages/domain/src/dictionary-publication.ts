import {
  parseDictionaryContent,
  type DictionaryContent,
  type DictionaryValidationResult,
} from './shared-dictionary'

export type DictionaryAnalysisValidationOutcome =
  'accepted' | 'rejected' | 'review-required'
export type DictionaryAnalysisDecisionCode =
  | 'same-meaning'
  | 'schema-invalid'
  | 'unsafe-media'
  | 'identity-mismatch'
  | 'meaning-mismatch'
  | 'meaning-uncertain'
interface ValidationEvidence {
  validator_version: string
  policy_sha256: string
  anchor_sha256: string
  input_sha256: string
  result_sha256: string
  meaning_evidence_sha256: string
}
export type DictionaryAnalysisValidationV1 = ValidationEvidence &
  (
    | {
        outcome: 'accepted'
        decision_code: 'same-meaning'
        content: DictionaryContent
        content_sha256: string
        cefr_input_sha256: string
      }
    | {
        outcome: 'rejected'
        decision_code:
          | 'schema-invalid'
          | 'unsafe-media'
          | 'identity-mismatch'
          | 'meaning-mismatch'
        content: null
        content_sha256: null
        cefr_input_sha256: null
      }
    | {
        outcome: 'review-required'
        decision_code: 'meaning-uncertain'
        content: null
        content_sha256: null
        cefr_input_sha256: null
      }
  )
interface ProvenanceBase {
  revision_id: string
  content_sha256: string
  verified_at: string
}
export type DictionaryRevisionProvenanceV2 = ProvenanceBase &
  (
    | { method: 'human'; validator_version: null; provider: null; model: null }
    | {
        method: 'automated'
        validator_version: string
        provider: string
        model: string
      }
  )

const SHA256 = /^[0-9a-f]{64}$/
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVIDENCE_FIELDS = [
  'validator_version',
  'policy_sha256',
  'anchor_sha256',
  'input_sha256',
  'result_sha256',
  'meaning_evidence_sha256',
]
const VALIDATION_FIELDS = [
  ...EVIDENCE_FIELDS,
  'outcome',
  'decision_code',
  'content',
  'content_sha256',
  'cefr_input_sha256',
]
const PROVENANCE_FIELDS = [
  'revision_id',
  'content_sha256',
  'verified_at',
  'method',
  'validator_version',
  'provider',
  'model',
]
class PublicationContractError extends Error {
  constructor(
    readonly path: string,
    message: string
  ) {
    super(message)
  }
}
const fail = (path: string, message: string): never => {
  throw new PublicationContractError(path, message)
}
const object = (
  value: unknown,
  fields: string[],
  path: string
): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return fail(path, 'must be an object')
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== fields.length ||
    fields.some(key => !Object.hasOwn(record, key))
  )
    fail(path, 'must contain exactly the supported fields')
  return record
}
const text = (value: unknown, limit: number, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '' || value.length > limit)
    return fail(path, 'must be bounded non-empty text')
  return value
}
const digest = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !SHA256.test(value))
    return fail(path, 'must be a SHA256')
  return value
}
const validate = <T>(read: () => T): DictionaryValidationResult<T> => {
  try {
    return { success: true, data: read() }
  } catch (error) {
    if (!(error instanceof PublicationContractError)) throw error
    return {
      success: false,
      issues: [{ path: error.path, message: error.message }],
    }
  }
}
export const parseDictionaryAnalysisValidationV1 = (
  value: unknown
): DictionaryValidationResult<DictionaryAnalysisValidationV1> =>
  validate(() => {
    const record = object(value, VALIDATION_FIELDS, 'validation')
    const base: ValidationEvidence = {
      validator_version: text(
        record.validator_version,
        100,
        'validator_version'
      ),
      policy_sha256: digest(record.policy_sha256, 'policy_sha256'),
      anchor_sha256: digest(record.anchor_sha256, 'anchor_sha256'),
      input_sha256: digest(record.input_sha256, 'input_sha256'),
      result_sha256: digest(record.result_sha256, 'result_sha256'),
      meaning_evidence_sha256: digest(
        record.meaning_evidence_sha256,
        'meaning_evidence_sha256'
      ),
    }
    if (
      record.outcome === 'accepted' &&
      record.decision_code === 'same-meaning'
    ) {
      const content = parseDictionaryContent(record.content)
      if (!content.success)
        return fail('content', content.issues[0]?.message ?? 'is invalid')
      return {
        ...base,
        outcome: 'accepted',
        decision_code: 'same-meaning',
        content: content.data,
        content_sha256: digest(record.content_sha256, 'content_sha256'),
        cefr_input_sha256: digest(
          record.cefr_input_sha256,
          'cefr_input_sha256'
        ),
      }
    }
    if (
      record.content !== null ||
      record.content_sha256 !== null ||
      record.cefr_input_sha256 !== null
    )
      fail('content', 'must be absent for failed or uncertain validation')
    if (
      record.outcome === 'review-required' &&
      record.decision_code === 'meaning-uncertain'
    )
      return {
        ...base,
        outcome: 'review-required',
        decision_code: 'meaning-uncertain',
        content: null,
        content_sha256: null,
        cefr_input_sha256: null,
      }
    if (
      record.outcome === 'rejected' &&
      [
        'schema-invalid',
        'unsafe-media',
        'identity-mismatch',
        'meaning-mismatch',
      ].some(code => code === record.decision_code)
    )
      return {
        ...base,
        outcome: 'rejected',
        decision_code: record.decision_code as
          | 'schema-invalid'
          | 'unsafe-media'
          | 'identity-mismatch'
          | 'meaning-mismatch',
        content: null,
        content_sha256: null,
        cefr_input_sha256: null,
      }
    return fail('outcome', 'must match a supported decision code')
  })

export const parseDictionaryRevisionProvenanceV2 = (
  value: unknown
): DictionaryValidationResult<DictionaryRevisionProvenanceV2[]> =>
  validate(() => {
    if (!Array.isArray(value) || value.length > 500)
      return fail('provenance', 'must be a batch of at most 500 revisions')
    const seen = new Set<string>()
    return value.map((item, index): DictionaryRevisionProvenanceV2 => {
      const path = `provenance[${index}]`
      const record = object(item, PROVENANCE_FIELDS, path)
      if (
        typeof record.revision_id !== 'string' ||
        !UUID.test(record.revision_id)
      )
        return fail(path, 'must reference a revision UUID')
      const id = record.revision_id.toLowerCase()
      if (seen.has(id)) fail(path, 'must not repeat a revision')
      seen.add(id)
      const verified = text(record.verified_at, 100, `${path}.verified_at`)
      if (
        !/^\d{4}-\d{2}-\d{2}T/.test(verified) ||
        !Number.isFinite(Date.parse(verified))
      )
        fail(path, 'must contain a verification timestamp')
      const base = {
        revision_id: id,
        content_sha256: digest(record.content_sha256, `${path}.content_sha256`),
        verified_at: verified,
      }
      if (record.method === 'automated')
        return {
          ...base,
          method: 'automated',
          validator_version: text(
            record.validator_version,
            100,
            `${path}.validator_version`
          ),
          provider: text(record.provider, 100, `${path}.provider`),
          model: text(record.model, 200, `${path}.model`),
        }
      if (
        record.method === 'human' &&
        record.validator_version === null &&
        record.provider === null &&
        record.model === null
      )
        return {
          ...base,
          method: 'human',
          validator_version: null,
          provider: null,
          model: null,
        }
      return fail(
        path,
        'must distinguish human review from automated validation'
      )
    })
  })
