export const OFFICIAL_CONTENT_SCHEMA_VERSION = 1 as const

export type OfficialContentReviewStatus = 'pending' | 'approved'
export type OfficialContentRegister = 'formal' | 'informal' | 'neutral'
export type OfficialContentExpressionType =
  | 'idiom'
  | 'phrase'
  | 'collocation'
  | 'compound'
  | 'proverb'
  | 'saying'
  | 'fixed_expression'
  | 'interjection'
  | 'abbreviation'

export interface OfficialContentExample {
  nl: string
  en: string
  ru?: string
}

export interface OfficialContentConjugation {
  present: string
  simple_past: string
  simple_past_plural?: string
  past_participle: string
}

export interface OfficialContentEntry {
  entry_id: string
  dutch_lemma: string
  dutch_original?: string | null
  part_of_speech: string
  translations: { en: string[]; ru?: string[] }
  examples?: OfficialContentExample[]
  is_irregular?: boolean
  is_reflexive?: boolean
  is_expression?: boolean
  expression_type?: OfficialContentExpressionType | null
  is_separable?: boolean
  prefix_part?: string | null
  root_verb?: string | null
  article?: 'de' | 'het' | null
  plural?: string | null
  register?: OfficialContentRegister | null
  synonyms?: string[]
  antonyms?: string[]
  conjugation?: OfficialContentConjugation | null
  preposition?: string | null
  analysis_notes?: string | null
}

export interface OfficialContentManifest {
  schema_version: typeof OFFICIAL_CONTENT_SCHEMA_VERSION
  pack_id: string
  version: string
  title: string
  description: string
  source_language: 'nl'
  translation_languages: string[]
  created_at: string
  license: {
    name: string
    url: string | null
    notes: string
  }
  provenance: {
    origin: 'original-project-content' | 'existing-project-library'
    source_snapshot_at?: string
    source_card_count?: number
    source_unique_semantic_count?: number
    selection_method?: string
    notes: string
    excluded_sources: string[]
  }
  content_review: {
    status: OfficialContentReviewStatus
    reviewed_by: string | null
    reviewed_at: string | null
    notes: string
  }
  entries: OfficialContentEntry[]
}

export interface OfficialContentValidationIssue {
  path: string
  message: string
}

export type OfficialContentValidationResult =
  | { success: true; data: OfficialContentManifest }
  | { success: false; issues: OfficialContentValidationIssue[] }

type UnknownRecord = Record<string, unknown>

const canonicalizeJson = (value: unknown): string => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Official content contains a non-finite number.')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(',')}]`
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left === right ? 0 : left < right ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeJson(item)}`)
    return `{${entries.join(',')}}`
  }
  throw new Error('Official content contains an unsupported JSON value.')
}

export const canonicalizeOfficialContent = (manifest: unknown): string =>
  canonicalizeJson(manifest)

const MUST_BE_OBJECT = 'must be an object'
const MUST_BE_NON_EMPTY_STRING = 'must be a non-empty string'
const MUST_BE_NULLABLE_STRING = 'must be a non-empty string or null'
const EXPRESSION_TYPES = new Set<OfficialContentExpressionType>([
  'idiom',
  'phrase',
  'collocation',
  'compound',
  'proverb',
  'saying',
  'fixed_expression',
  'interjection',
  'abbreviation',
])
const FORBIDDEN_ENTRY_FIELDS = [
  'word_id',
  'user_id',
  'collection_id',
  'created_at',
  'updated_at',
  'image_url',
  'tts_url',
  'interval_days',
  'repetition_count',
  'easiness_factor',
  'next_review_date',
  'last_reviewed_at',
  'knowledge_level',
  'review_history',
  'srs_state',
]
const MANIFEST_FIELDS = new Set([
  'schema_version',
  'pack_id',
  'version',
  'title',
  'description',
  'source_language',
  'translation_languages',
  'created_at',
  'license',
  'provenance',
  'content_review',
  'entries',
])
const LICENSE_FIELDS = new Set(['name', 'url', 'notes'])
const PROVENANCE_FIELDS = new Set([
  'origin',
  'source_snapshot_at',
  'source_card_count',
  'source_unique_semantic_count',
  'selection_method',
  'notes',
  'excluded_sources',
])
const CONTENT_REVIEW_FIELDS = new Set([
  'status',
  'reviewed_by',
  'reviewed_at',
  'notes',
])
const ENTRY_FIELDS = new Set([
  'entry_id',
  'dutch_lemma',
  'dutch_original',
  'part_of_speech',
  'translations',
  'examples',
  'is_irregular',
  'is_reflexive',
  'is_expression',
  'expression_type',
  'is_separable',
  'prefix_part',
  'root_verb',
  'article',
  'plural',
  'register',
  'synonyms',
  'antonyms',
  'conjugation',
  'preposition',
  'analysis_notes',
])
const TRANSLATION_FIELDS = new Set(['en', 'ru'])
const EXAMPLE_FIELDS = new Set(['nl', 'en', 'ru'])
const CONJUGATION_FIELDS = new Set([
  'present',
  'simple_past',
  'simple_past_plural',
  'past_participle',
])

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

const isNullableString = (value: unknown): value is string | null =>
  value === null || isNonEmptyString(value)

const isStringArray = (value: unknown, allowEmpty = true): value is string[] =>
  Array.isArray(value) &&
  (allowEmpty || value.length > 0) &&
  value.every(isNonEmptyString)

const addIssue = (
  issues: OfficialContentValidationIssue[],
  path: string,
  message: string
): void => {
  issues.push({ path, message })
}

const validateAllowedKeys = (
  value: UnknownRecord,
  allowed: ReadonlySet<string>,
  path: string,
  issues: OfficialContentValidationIssue[]
): void => {
  Object.keys(value).forEach(field => {
    if (!allowed.has(field)) {
      addIssue(
        issues,
        path === '' ? field : `${path}.${field}`,
        'is not an allowed official content field'
      )
    }
  })
}

const validateTranslations = (
  value: unknown,
  path: string,
  issues: OfficialContentValidationIssue[]
): void => {
  if (!isRecord(value)) {
    addIssue(issues, path, MUST_BE_OBJECT)
    return
  }
  validateAllowedKeys(value, TRANSLATION_FIELDS, path, issues)
  if (!isStringArray(value.en, false)) {
    addIssue(issues, `${path}.en`, 'must contain at least one translation')
  }
  if (value.ru !== undefined && !isStringArray(value.ru, false)) {
    addIssue(
      issues,
      `${path}.ru`,
      'must contain at least one translation when provided'
    )
  }
}

const validateExamples = (
  value: unknown,
  path: string,
  issues: OfficialContentValidationIssue[]
): void => {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'must be an array')
    return
  }
  value.forEach((example, index) => {
    const examplePath = `${path}[${index}]`
    if (!isRecord(example)) {
      addIssue(issues, examplePath, MUST_BE_OBJECT)
      return
    }
    validateAllowedKeys(example, EXAMPLE_FIELDS, examplePath, issues)
    if (!isNonEmptyString(example.nl)) {
      addIssue(issues, `${examplePath}.nl`, MUST_BE_NON_EMPTY_STRING)
    }
    if (!isNonEmptyString(example.en)) {
      addIssue(issues, `${examplePath}.en`, MUST_BE_NON_EMPTY_STRING)
    }
    if (example.ru !== undefined && !isNonEmptyString(example.ru)) {
      addIssue(
        issues,
        `${examplePath}.ru`,
        `${MUST_BE_NON_EMPTY_STRING} when provided`
      )
    }
  })
}

const validateConjugation = (
  value: unknown,
  path: string,
  issues: OfficialContentValidationIssue[]
): void => {
  if (value === undefined || value === null) return
  if (!isRecord(value)) {
    addIssue(issues, path, `${MUST_BE_OBJECT} or null`)
    return
  }
  validateAllowedKeys(value, CONJUGATION_FIELDS, path, issues)
  ;['present', 'simple_past', 'past_participle'].forEach(field => {
    if (!isNonEmptyString(value[field])) {
      addIssue(issues, `${path}.${field}`, MUST_BE_NON_EMPTY_STRING)
    }
  })
  if (
    value.simple_past_plural !== undefined &&
    !isNonEmptyString(value.simple_past_plural)
  ) {
    addIssue(
      issues,
      `${path}.simple_past_plural`,
      `${MUST_BE_NON_EMPTY_STRING} when provided`
    )
  }
}

const validateEntry = (
  value: unknown,
  index: number,
  issues: OfficialContentValidationIssue[]
): void => {
  const path = `entries[${index}]`
  if (!isRecord(value)) {
    addIssue(issues, path, MUST_BE_OBJECT)
    return
  }
  validateAllowedKeys(value, ENTRY_FIELDS, path, issues)

  ;['entry_id', 'dutch_lemma', 'part_of_speech'].forEach(field => {
    if (!isNonEmptyString(value[field])) {
      addIssue(issues, `${path}.${field}`, MUST_BE_NON_EMPTY_STRING)
    }
  })
  validateTranslations(value.translations, `${path}.translations`, issues)
  validateExamples(value.examples, `${path}.examples`, issues)
  validateConjugation(value.conjugation, `${path}.conjugation`, issues)

  ;['is_irregular', 'is_reflexive', 'is_expression', 'is_separable'].forEach(
    field => {
      if (value[field] !== undefined && typeof value[field] !== 'boolean') {
        addIssue(issues, `${path}.${field}`, 'must be a boolean when provided')
      }
    }
  )
  if (
    value.article !== undefined &&
    value.article !== null &&
    value.article !== 'de' &&
    value.article !== 'het'
  ) {
    addIssue(issues, `${path}.article`, 'must be de, het, or null')
  }
  if (
    value.register !== undefined &&
    value.register !== null &&
    value.register !== 'formal' &&
    value.register !== 'informal' &&
    value.register !== 'neutral'
  ) {
    addIssue(
      issues,
      `${path}.register`,
      'must be formal, informal, neutral, or null'
    )
  }
  if (
    value.expression_type !== undefined &&
    value.expression_type !== null &&
    (!isNonEmptyString(value.expression_type) ||
      !EXPRESSION_TYPES.has(
        value.expression_type as OfficialContentExpressionType
      ))
  ) {
    addIssue(issues, `${path}.expression_type`, 'is not supported')
  }
  ;[
    'dutch_original',
    'plural',
    'prefix_part',
    'root_verb',
    'preposition',
    'analysis_notes',
  ].forEach(field => {
    if (value[field] !== undefined && !isNullableString(value[field])) {
      addIssue(issues, `${path}.${field}`, MUST_BE_NULLABLE_STRING)
    }
  })
  ;['synonyms', 'antonyms'].forEach(field => {
    if (value[field] !== undefined && !isStringArray(value[field])) {
      addIssue(issues, `${path}.${field}`, 'must be an array of strings')
    }
  })
  if (value.is_separable === true) {
    if (!isNonEmptyString(value.prefix_part)) {
      addIssue(
        issues,
        `${path}.prefix_part`,
        'is required for a separable verb'
      )
    }
    if (!isNonEmptyString(value.root_verb)) {
      addIssue(issues, `${path}.root_verb`, 'is required for a separable verb')
    }
  }
  FORBIDDEN_ENTRY_FIELDS.forEach(field => {
    if (field in value) {
      addIssue(
        issues,
        `${path}.${field}`,
        'must not be stored in official content'
      )
    }
  })
}

const validateMetadata = (
  value: UnknownRecord,
  issues: OfficialContentValidationIssue[]
): void => {
  if (value.schema_version !== OFFICIAL_CONTENT_SCHEMA_VERSION) {
    addIssue(issues, 'schema_version', 'is not supported')
  }
  ;['pack_id', 'version', 'title', 'description', 'created_at'].forEach(
    field => {
      if (!isNonEmptyString(value[field])) {
        addIssue(issues, field, MUST_BE_NON_EMPTY_STRING)
      }
    }
  )
  if (value.source_language !== 'nl') {
    addIssue(issues, 'source_language', 'must be nl')
  }
  if (
    !isStringArray(value.translation_languages, false) ||
    !value.translation_languages.includes('en')
  ) {
    addIssue(
      issues,
      'translation_languages',
      'must contain the English language code'
    )
  }
}

const validatePolicyMetadata = (
  value: UnknownRecord,
  issues: OfficialContentValidationIssue[]
): void => {
  const license = value.license
  if (!isRecord(license)) {
    addIssue(issues, 'license', MUST_BE_OBJECT)
  } else {
    validateAllowedKeys(license, LICENSE_FIELDS, 'license', issues)
    if (!isNonEmptyString(license.name)) {
      addIssue(issues, 'license.name', MUST_BE_NON_EMPTY_STRING)
    }
    if (!isNullableString(license.url)) {
      addIssue(issues, 'license.url', MUST_BE_NULLABLE_STRING)
    }
    if (!isNonEmptyString(license.notes)) {
      addIssue(issues, 'license.notes', MUST_BE_NON_EMPTY_STRING)
    }
  }

  const provenance = value.provenance
  if (!isRecord(provenance)) {
    addIssue(issues, 'provenance', MUST_BE_OBJECT)
  } else {
    validateAllowedKeys(provenance, PROVENANCE_FIELDS, 'provenance', issues)
    if (
      provenance.origin !== 'original-project-content' &&
      provenance.origin !== 'existing-project-library'
    ) {
      addIssue(issues, 'provenance.origin', 'must identify an approved source')
    }
    if (!isNonEmptyString(provenance.notes)) {
      addIssue(issues, 'provenance.notes', MUST_BE_NON_EMPTY_STRING)
    }
    if (!isStringArray(provenance.excluded_sources, false)) {
      addIssue(
        issues,
        'provenance.excluded_sources',
        'must list excluded external content sources'
      )
    }
    if (provenance.origin === 'existing-project-library') {
      ;['source_snapshot_at', 'selection_method'].forEach(field => {
        if (!isNonEmptyString(provenance[field])) {
          addIssue(issues, `provenance.${field}`, MUST_BE_NON_EMPTY_STRING)
        }
      })
      ;['source_card_count', 'source_unique_semantic_count'].forEach(field => {
        if (
          typeof provenance[field] !== 'number' ||
          !Number.isInteger(provenance[field]) ||
          provenance[field] <= 0
        ) {
          addIssue(issues, `provenance.${field}`, 'must be a positive integer')
        }
      })
    }
  }
}

const validateContentReview = (
  value: unknown,
  issues: OfficialContentValidationIssue[]
): void => {
  if (!isRecord(value)) {
    addIssue(issues, 'content_review', MUST_BE_OBJECT)
    return
  }
  validateAllowedKeys(value, CONTENT_REVIEW_FIELDS, 'content_review', issues)
  if (value.status !== 'pending' && value.status !== 'approved') {
    addIssue(issues, 'content_review.status', 'must be pending or approved')
  }
  if (!isNullableString(value.reviewed_by)) {
    addIssue(issues, 'content_review.reviewed_by', MUST_BE_NULLABLE_STRING)
  }
  if (!isNullableString(value.reviewed_at)) {
    addIssue(issues, 'content_review.reviewed_at', MUST_BE_NULLABLE_STRING)
  }
  if (!isNonEmptyString(value.notes)) {
    addIssue(issues, 'content_review.notes', MUST_BE_NON_EMPTY_STRING)
  }
  if (
    value.status === 'approved' &&
    (!isNonEmptyString(value.reviewed_by) ||
      !isNonEmptyString(value.reviewed_at))
  ) {
    addIssue(
      issues,
      'content_review',
      'approved content requires a reviewer and review date'
    )
  }
}

export const validateOfficialContentManifest = (
  value: unknown
): OfficialContentValidationResult => {
  if (!isRecord(value)) {
    return {
      success: false,
      issues: [{ path: 'manifest', message: MUST_BE_OBJECT }],
    }
  }

  const issues: OfficialContentValidationIssue[] = []
  validateAllowedKeys(value, MANIFEST_FIELDS, '', issues)
  validateMetadata(value, issues)
  validatePolicyMetadata(value, issues)
  validateContentReview(value.content_review, issues)

  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    addIssue(issues, 'entries', 'must contain at least one entry')
  } else {
    const ids = new Set<string>()
    value.entries.forEach((entry, index) => {
      validateEntry(entry, index, issues)
      if (!isRecord(entry) || !isNonEmptyString(entry.entry_id)) return
      if (ids.has(entry.entry_id)) {
        addIssue(issues, `entries[${index}].entry_id`, 'must be unique')
      }
      ids.add(entry.entry_id)
    })
  }

  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: value as unknown as OfficialContentManifest }
}

export class OfficialContentValidationError extends Error {
  readonly issues: OfficialContentValidationIssue[]

  constructor(issues: OfficialContentValidationIssue[]) {
    super(
      `Official content validation failed: ${issues
        .map(issue => `${issue.path} ${issue.message}`)
        .join('; ')}`
    )
    this.name = 'OfficialContentValidationError'
    this.issues = issues
  }
}
