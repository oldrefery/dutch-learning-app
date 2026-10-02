export const DICTIONARY_CONTENT_PROTOCOL_VERSION = 1 as const
export const DICTIONARY_CONTENT_SCHEMA_VERSION = 1 as const
export const CEFR_INPUT_SCHEMA_VERSION = 1 as const

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]
export type CefrAssessmentStatus = 'unknown' | 'estimated' | 'reviewed'
export type DictionaryEntryState = 'draft' | 'published' | 'retired'
export type DictionaryRevisionStatus = 'draft' | 'published' | 'retired'
export type DictionaryContentSource = 'pinned' | 'fallback' | 'missing'

export interface DictionaryExample {
  nl: string
  en: string
  ru: string | null
}

export interface DictionaryConjugation {
  present: string
  simple_past: string
  simple_past_plural: string | null
  past_participle: string
}

export interface DictionaryUsageContrast {
  term: string
  distinction: string
  example: DictionaryExample | null
}

export interface DictionaryUsageNotes {
  summary: string
  contrasts: DictionaryUsageContrast[]
}

export interface DictionaryContent {
  dutch_lemma: string
  dutch_original: string | null
  part_of_speech: string | null
  article: 'de' | 'het' | null
  translations: { en: string[]; ru: string[] }
  examples: DictionaryExample[]
  is_irregular: boolean
  is_reflexive: boolean
  is_expression: boolean
  expression_type: string | null
  is_separable: boolean
  prefix_part: string | null
  root_verb: string | null
  plural: string | null
  register: 'formal' | 'informal' | 'neutral' | null
  synonyms: string[]
  antonyms: string[]
  conjugation: DictionaryConjugation | null
  preposition: string | null
  analysis_notes: string | null
  usage_notes: DictionaryUsageNotes | null
  image_url: string | null
  tts_url: string | null
}

export type DictionaryContentField = keyof DictionaryContent
export type DictionaryOverrideOperation<Value> =
  { op: 'set'; value: Value } | { op: 'remove' }
export type DictionaryContentOverrides = Partial<{
  [Field in DictionaryContentField]: DictionaryOverrideOperation<
    DictionaryContent[Field]
  >
}>

export interface DictionaryEntry {
  entry_id: string
  language_code: string
  lemma: string
  part_of_speech: string | null
  article: 'de' | 'het' | null
  sense_key: string
  state: DictionaryEntryState
}

export interface DictionaryRevision {
  revision_id: string
  entry_id: string
  revision_no: number
  schema_version: typeof DICTIONARY_CONTENT_SCHEMA_VERSION
  content: DictionaryContent
  content_sha256: string
  cefr_input_sha256: string
  review_status: DictionaryRevisionStatus
}

export interface DictionaryReference {
  entry_id: string
  revision_id: string
}

export interface DictionaryCefrAssessment {
  assessment_id: string
  entry_id: string
  input_sha256: string
  cefr_level: CefrLevel | null
  status: CefrAssessmentStatus
  confidence: number | null
  method: string
  method_version: string
  locked: boolean
  supersedes_assessment_id: string | null
}

export interface DictionaryValidationIssue {
  path: string
  message: string
}

export type DictionaryValidationResult<Value> =
  | { success: true; data: Value }
  | { success: false; issues: DictionaryValidationIssue[] }

type UnknownRecord = Record<string, unknown>
type FieldParser = (
  value: unknown,
  path: string,
  issues: DictionaryValidationIssue[]
) => unknown

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/
const MUST_BE_OBJECT = 'must be an object'
const IS_NOT_SUPPORTED = 'is not supported'
const CONTENT_FIELDS = [
  'dutch_lemma',
  'dutch_original',
  'part_of_speech',
  'article',
  'translations',
  'examples',
  'is_irregular',
  'is_reflexive',
  'is_expression',
  'expression_type',
  'is_separable',
  'prefix_part',
  'root_verb',
  'plural',
  'register',
  'synonyms',
  'antonyms',
  'conjugation',
  'preposition',
  'analysis_notes',
  'usage_notes',
  'image_url',
  'tts_url',
] as const satisfies readonly DictionaryContentField[]
const LINGUISTIC_CONTENT_FIELDS = new Set<DictionaryContentField>(
  CONTENT_FIELDS.filter(field => field !== 'image_url' && field !== 'tts_url')
)

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOwn = (value: UnknownRecord, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, field)

const addIssue = (
  issues: DictionaryValidationIssue[],
  path: string,
  message: string
): void => {
  issues.push({ path, message })
}

const parseNonEmptyString = (
  value: unknown,
  path: string,
  issues: DictionaryValidationIssue[],
  limit = 4_000
): string | null => {
  if (typeof value !== 'string' || value.trim() === '') {
    addIssue(issues, path, 'must be a non-empty string')
    return null
  }
  if (value.length > limit) {
    addIssue(issues, path, `must contain at most ${limit} characters`)
    return null
  }
  return value.trim()
}

const parseNullableString = (
  value: unknown,
  path: string,
  issues: DictionaryValidationIssue[],
  limit?: number
): string | null => {
  if (value === null) return null
  return parseNonEmptyString(value, path, issues, limit)
}

const parseStringArray = (
  value: unknown,
  path: string,
  issues: DictionaryValidationIssue[],
  { min = 0, max = 50 }: { min?: number; max?: number } = {}
): string[] => {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    addIssue(issues, path, `must be an array with ${min} to ${max} values`)
    return []
  }
  const parsed = value.map((item, index) =>
    parseNonEmptyString(item, `${path}[${index}]`, issues, 500)
  )
  return parsed.filter((item): item is string => item !== null)
}

const validateKeys = (
  value: UnknownRecord,
  fields: readonly string[],
  path: string,
  issues: DictionaryValidationIssue[],
  requireAll = true
): void => {
  const allowed = new Set(fields)
  Object.keys(value).forEach(field => {
    if (!allowed.has(field))
      addIssue(issues, `${path}.${field}`, 'is not allowed')
  })
  if (requireAll) {
    fields.forEach(field => {
      if (!hasOwn(value, field))
        addIssue(issues, `${path}.${field}`, 'is required')
    })
  }
}

const parseExample = (
  value: unknown,
  path: string,
  issues: DictionaryValidationIssue[]
): DictionaryExample | null => {
  if (!isRecord(value)) {
    addIssue(issues, path, MUST_BE_OBJECT)
    return null
  }
  validateKeys(value, ['nl', 'en', 'ru'], path, issues)
  const nl = parseNonEmptyString(value.nl, `${path}.nl`, issues, 1_000)
  const en = parseNonEmptyString(value.en, `${path}.en`, issues, 1_000)
  const ru = parseNullableString(value.ru, `${path}.ru`, issues, 1_000)
  return nl === null || en === null ? null : { nl, en, ru }
}

const parseExamples: FieldParser = (value, path, issues) => {
  if (!Array.isArray(value) || value.length > 20) {
    addIssue(issues, path, 'must be an array with at most 20 examples')
    return []
  }
  return value
    .map((item, index) => parseExample(item, `${path}[${index}]`, issues))
    .filter((item): item is DictionaryExample => item !== null)
}

const parseTranslations: FieldParser = (value, path, issues) => {
  if (!isRecord(value)) {
    addIssue(issues, path, MUST_BE_OBJECT)
    return { en: [], ru: [] }
  }
  validateKeys(value, ['en', 'ru'], path, issues)
  return {
    en: parseStringArray(value.en, `${path}.en`, issues, { min: 1, max: 30 }),
    ru: parseStringArray(value.ru, `${path}.ru`, issues, { max: 30 }),
  }
}

const parseConjugation: FieldParser = (value, path, issues) => {
  if (value === null) return null
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object or null')
    return null
  }
  validateKeys(
    value,
    ['present', 'simple_past', 'simple_past_plural', 'past_participle'],
    path,
    issues
  )
  const present = parseNonEmptyString(
    value.present,
    `${path}.present`,
    issues,
    500
  )
  const simplePast = parseNonEmptyString(
    value.simple_past,
    `${path}.simple_past`,
    issues,
    500
  )
  const simplePastPlural = parseNullableString(
    value.simple_past_plural,
    `${path}.simple_past_plural`,
    issues,
    500
  )
  const pastParticiple = parseNonEmptyString(
    value.past_participle,
    `${path}.past_participle`,
    issues,
    500
  )
  return present === null || simplePast === null || pastParticiple === null
    ? null
    : {
        present,
        simple_past: simplePast,
        simple_past_plural: simplePastPlural,
        past_participle: pastParticiple,
      }
}

const parseUsageNotes: FieldParser = (value, path, issues) => {
  if (value === null) return null
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object or null')
    return null
  }
  validateKeys(value, ['summary', 'contrasts'], path, issues)
  const summary = parseNonEmptyString(
    value.summary,
    `${path}.summary`,
    issues,
    2_000
  )
  if (!Array.isArray(value.contrasts) || value.contrasts.length > 5) {
    addIssue(
      issues,
      `${path}.contrasts`,
      'must be an array with at most 5 values'
    )
    return null
  }
  const contrasts = value.contrasts
    .map((item, index) => {
      const itemPath = `${path}.contrasts[${index}]`
      if (!isRecord(item)) {
        addIssue(issues, itemPath, MUST_BE_OBJECT)
        return null
      }
      validateKeys(item, ['term', 'distinction', 'example'], itemPath, issues)
      const term = parseNonEmptyString(
        item.term,
        `${itemPath}.term`,
        issues,
        500
      )
      const distinction = parseNonEmptyString(
        item.distinction,
        `${itemPath}.distinction`,
        issues,
        2_000
      )
      const example =
        item.example === null
          ? null
          : parseExample(item.example, `${itemPath}.example`, issues)
      return term === null ||
        distinction === null ||
        (item.example !== null && example === null)
        ? null
        : { term, distinction, example }
    })
    .filter((item): item is DictionaryUsageContrast => item !== null)
  return summary === null ? null : { summary, contrasts }
}

const parseBoolean: FieldParser = (value, path, issues) => {
  if (typeof value !== 'boolean') addIssue(issues, path, 'must be a boolean')
  return value === true
}

const parseArticle: FieldParser = (value, path, issues) => {
  if (value === null || value === 'de' || value === 'het') return value
  addIssue(issues, path, 'must be de, het, or null')
  return null
}

const parseRegister: FieldParser = (value, path, issues) => {
  if (
    value === null ||
    value === 'formal' ||
    value === 'informal' ||
    value === 'neutral'
  ) {
    return value
  }
  addIssue(issues, path, 'must be formal, informal, neutral, or null')
  return null
}

const contentFieldParsers: Record<DictionaryContentField, FieldParser> = {
  dutch_lemma: (value, path, issues) =>
    parseNonEmptyString(value, path, issues, 120),
  dutch_original: (value, path, issues) =>
    parseNullableString(value, path, issues, 120),
  part_of_speech: (value, path, issues) =>
    parseNullableString(value, path, issues, 80),
  article: parseArticle,
  translations: parseTranslations,
  examples: parseExamples,
  is_irregular: parseBoolean,
  is_reflexive: parseBoolean,
  is_expression: parseBoolean,
  expression_type: (value, path, issues) =>
    parseNullableString(value, path, issues, 80),
  is_separable: parseBoolean,
  prefix_part: (value, path, issues) =>
    parseNullableString(value, path, issues, 120),
  root_verb: (value, path, issues) =>
    parseNullableString(value, path, issues, 120),
  plural: (value, path, issues) =>
    parseNullableString(value, path, issues, 120),
  register: parseRegister,
  synonyms: (value, path, issues) => parseStringArray(value, path, issues),
  antonyms: (value, path, issues) => parseStringArray(value, path, issues),
  conjugation: parseConjugation,
  preposition: (value, path, issues) =>
    parseNullableString(value, path, issues, 120),
  analysis_notes: (value, path, issues) =>
    parseNullableString(value, path, issues, 4_000),
  usage_notes: parseUsageNotes,
  image_url: (value, path, issues) =>
    parseNullableString(value, path, issues, 2_000),
  tts_url: (value, path, issues) =>
    parseNullableString(value, path, issues, 2_000),
}

const toResult = <Value>(
  issues: DictionaryValidationIssue[],
  data: Value
): DictionaryValidationResult<Value> =>
  issues.length === 0 ? { success: true, data } : { success: false, issues }

export const parseDictionaryContent = (
  value: unknown
): DictionaryValidationResult<DictionaryContent> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'content', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  validateKeys(value, CONTENT_FIELDS, 'content', issues)
  const parsed: Record<string, unknown> = {}
  CONTENT_FIELDS.forEach(field => {
    parsed[field] = contentFieldParsers[field](
      value[field],
      `content.${field}`,
      issues
    )
  })
  if (parsed.is_separable === true) {
    if (parsed.prefix_part === null) {
      addIssue(
        issues,
        'content.prefix_part',
        'is required for a separable verb'
      )
    }
    if (parsed.root_verb === null) {
      addIssue(issues, 'content.root_verb', 'is required for a separable verb')
    }
  }
  return toResult(issues, parsed as unknown as DictionaryContent)
}

const parseUuid = (
  value: unknown,
  path: string,
  issues: DictionaryValidationIssue[]
): string | null => {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    addIssue(issues, path, 'must be a UUID')
    return null
  }
  return value.toLowerCase()
}

const parseSha256 = (
  value: unknown,
  path: string,
  issues: DictionaryValidationIssue[]
): string | null => {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    addIssue(issues, path, 'must be a lowercase SHA-256 hex digest')
    return null
  }
  return value
}

export const parseDictionaryEntry = (
  value: unknown
): DictionaryValidationResult<DictionaryEntry> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'entry', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  const fields = [
    'entry_id',
    'language_code',
    'lemma',
    'part_of_speech',
    'article',
    'sense_key',
    'state',
  ]
  validateKeys(value, fields, 'entry', issues)
  const entryId = parseUuid(value.entry_id, 'entry.entry_id', issues)
  const languageCode = parseNonEmptyString(
    value.language_code,
    'entry.language_code',
    issues,
    10
  )
  if (languageCode !== null && !LANGUAGE_CODE_PATTERN.test(languageCode)) {
    addIssue(issues, 'entry.language_code', 'is not a supported language code')
  }
  const lemma = parseNonEmptyString(value.lemma, 'entry.lemma', issues, 120)
  const partOfSpeech = parseNullableString(
    value.part_of_speech,
    'entry.part_of_speech',
    issues,
    80
  )
  const article = parseArticle(
    value.article,
    'entry.article',
    issues
  ) as DictionaryEntry['article']
  const senseKey = parseNonEmptyString(
    value.sense_key,
    'entry.sense_key',
    issues,
    120
  )
  const state = value.state
  if (state !== 'draft' && state !== 'published' && state !== 'retired') {
    addIssue(issues, 'entry.state', 'must be draft, published, or retired')
  }
  return toResult(issues, {
    entry_id: entryId ?? '',
    language_code: languageCode ?? '',
    lemma: lemma ?? '',
    part_of_speech: partOfSpeech,
    article,
    sense_key: senseKey ?? '',
    state: state as DictionaryEntryState,
  })
}

export const parseDictionaryReference = (
  value: unknown
): DictionaryValidationResult<DictionaryReference> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'reference', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  validateKeys(value, ['entry_id', 'revision_id'], 'reference', issues)
  const entryId = parseUuid(value.entry_id, 'reference.entry_id', issues)
  const revisionId = parseUuid(
    value.revision_id,
    'reference.revision_id',
    issues
  )
  return toResult(issues, {
    entry_id: entryId ?? '',
    revision_id: revisionId ?? '',
  })
}

export const parseDictionaryRevision = (
  value: unknown
): DictionaryValidationResult<DictionaryRevision> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'revision', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  const fields = [
    'revision_id',
    'entry_id',
    'revision_no',
    'schema_version',
    'content',
    'content_sha256',
    'cefr_input_sha256',
    'review_status',
  ]
  validateKeys(value, fields, 'revision', issues)
  const revisionId = parseUuid(
    value.revision_id,
    'revision.revision_id',
    issues
  )
  const entryId = parseUuid(value.entry_id, 'revision.entry_id', issues)
  const revisionNo = value.revision_no
  if (
    !Number.isInteger(revisionNo) ||
    typeof revisionNo !== 'number' ||
    revisionNo < 1
  ) {
    addIssue(issues, 'revision.revision_no', 'must be a positive integer')
  }
  if (value.schema_version !== DICTIONARY_CONTENT_SCHEMA_VERSION) {
    addIssue(issues, 'revision.schema_version', IS_NOT_SUPPORTED)
  }
  const parsedContent = parseDictionaryContent(value.content)
  if (!parsedContent.success) {
    parsedContent.issues.forEach(issue =>
      addIssue(
        issues,
        issue.path.replace(/^content/, 'revision.content'),
        issue.message
      )
    )
  }
  const contentSha = parseSha256(
    value.content_sha256,
    'revision.content_sha256',
    issues
  )
  const cefrInputSha = parseSha256(
    value.cefr_input_sha256,
    'revision.cefr_input_sha256',
    issues
  )
  const status = value.review_status
  if (status !== 'draft' && status !== 'published' && status !== 'retired') {
    addIssue(
      issues,
      'revision.review_status',
      'must be draft, published, or retired'
    )
  }
  return toResult(issues, {
    revision_id: revisionId ?? '',
    entry_id: entryId ?? '',
    revision_no: typeof revisionNo === 'number' ? revisionNo : 0,
    schema_version: DICTIONARY_CONTENT_SCHEMA_VERSION,
    content: parsedContent.success
      ? parsedContent.data
      : ({} as DictionaryContent),
    content_sha256: contentSha ?? '',
    cefr_input_sha256: cefrInputSha ?? '',
    review_status: status as DictionaryRevisionStatus,
  })
}

export const parseDictionaryContentOverrides = (
  value: unknown
): DictionaryValidationResult<DictionaryContentOverrides> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'overrides', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  validateKeys(value, CONTENT_FIELDS, 'overrides', issues, false)
  const parsed: Record<string, unknown> = {}
  CONTENT_FIELDS.forEach(field => {
    if (!hasOwn(value, field)) return
    const path = `overrides.${field}`
    const operation = value[field]
    if (!isRecord(operation)) {
      addIssue(issues, path, MUST_BE_OBJECT)
      return
    }
    if (operation.op === 'remove') {
      validateKeys(operation, ['op'], path, issues)
      parsed[field] = { op: 'remove' }
      return
    }
    if (operation.op === 'set') {
      validateKeys(operation, ['op', 'value'], path, issues)
      if (!hasOwn(operation, 'value')) {
        addIssue(issues, `${path}.value`, 'is required')
        return
      }
      parsed[field] = {
        op: 'set',
        value: contentFieldParsers[field](
          operation.value,
          `${path}.value`,
          issues
        ),
      }
      return
    }
    addIssue(issues, `${path}.op`, 'must be set or remove')
  })
  return toResult(issues, parsed as DictionaryContentOverrides)
}

const parseAssessmentState = (
  value: UnknownRecord,
  issues: DictionaryValidationIssue[]
): Pick<DictionaryCefrAssessment, 'cefr_level' | 'status' | 'locked'> => {
  const level = value.cefr_level
  const status = value.status
  const isKnownLevel = CEFR_LEVELS.includes(level as CefrLevel)
  const isKnownStatus =
    status === 'unknown' || status === 'estimated' || status === 'reviewed'
  if (level !== null && !isKnownLevel) {
    addIssue(issues, 'assessment.cefr_level', 'must be a CEFR level or null')
  }
  if (!isKnownStatus) {
    addIssue(
      issues,
      'assessment.status',
      'must be unknown, estimated, or reviewed'
    )
  }
  if (
    (status === 'unknown' && level !== null) ||
    (status !== 'unknown' && level === null)
  ) {
    addIssue(
      issues,
      'assessment.cefr_level',
      'must match the assessment status'
    )
  }
  if (typeof value.locked !== 'boolean') {
    addIssue(issues, 'assessment.locked', 'must be a boolean')
  }
  if (value.locked === true && status !== 'reviewed') {
    addIssue(issues, 'assessment.locked', 'requires reviewed status')
  }
  return {
    cefr_level: isKnownLevel ? (level as CefrLevel) : null,
    status: isKnownStatus ? status : 'unknown',
    locked: value.locked === true,
  }
}

export const parseDictionaryCefrAssessment = (
  value: unknown
): DictionaryValidationResult<DictionaryCefrAssessment> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'assessment', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  const fields = [
    'assessment_id',
    'entry_id',
    'input_sha256',
    'cefr_level',
    'status',
    'confidence',
    'method',
    'method_version',
    'locked',
    'supersedes_assessment_id',
  ]
  validateKeys(value, fields, 'assessment', issues)
  const assessmentId = parseUuid(
    value.assessment_id,
    'assessment.assessment_id',
    issues
  )
  const entryId = parseUuid(value.entry_id, 'assessment.entry_id', issues)
  const inputSha = parseSha256(
    value.input_sha256,
    'assessment.input_sha256',
    issues
  )
  const state = parseAssessmentState(value, issues)
  const confidence = value.confidence
  if (
    confidence !== null &&
    (typeof confidence !== 'number' ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1)
  ) {
    addIssue(
      issues,
      'assessment.confidence',
      'must be a number from 0 to 1 or null'
    )
  }
  const method = parseNonEmptyString(
    value.method,
    'assessment.method',
    issues,
    120
  )
  const methodVersion = parseNonEmptyString(
    value.method_version,
    'assessment.method_version',
    issues,
    120
  )
  const supersedes =
    value.supersedes_assessment_id === null
      ? null
      : parseUuid(
          value.supersedes_assessment_id,
          'assessment.supersedes_assessment_id',
          issues
        )
  return toResult(issues, {
    assessment_id: assessmentId ?? '',
    entry_id: entryId ?? '',
    input_sha256: inputSha ?? '',
    cefr_level: state.cefr_level,
    status: state.status,
    confidence: typeof confidence === 'number' ? confidence : null,
    method: method ?? '',
    method_version: methodVersion ?? '',
    locked: state.locked,
    supersedes_assessment_id: supersedes,
  })
}

export interface DictionaryContentCapability {
  dictionary_content_protocol: typeof DICTIONARY_CONTENT_PROTOCOL_VERSION
}

export type DictionaryContentCommand =
  | {
      protocol_version: typeof DICTIONARY_CONTENT_PROTOCOL_VERSION
      operation_id: string
      word_id: string
      expected_content_version: number
      kind: 'create-private'
      content: DictionaryContent
    }
  | {
      protocol_version: typeof DICTIONARY_CONTENT_PROTOCOL_VERSION
      operation_id: string
      word_id: string
      expected_content_version: number
      kind: 'edit-private'
      overrides: DictionaryContentOverrides
    }
  | {
      protocol_version: typeof DICTIONARY_CONTENT_PROTOCOL_VERSION
      operation_id: string
      word_id: string
      expected_content_version: number
      kind: 'link' | 'adopt-revision'
      reference: DictionaryReference
      overrides: DictionaryContentOverrides
    }
  | {
      protocol_version: typeof DICTIONARY_CONTENT_PROTOCOL_VERSION
      operation_id: string
      word_id: string
      expected_content_version: number
      kind: 'detach' | 'resolve-conflict'
      content: DictionaryContent
    }

const parseContentCommandBase = (
  value: UnknownRecord,
  issues: DictionaryValidationIssue[]
): Pick<
  DictionaryContentCommand,
  'protocol_version' | 'operation_id' | 'word_id' | 'expected_content_version'
> => {
  if (value.protocol_version !== DICTIONARY_CONTENT_PROTOCOL_VERSION) {
    addIssue(issues, 'command.protocol_version', IS_NOT_SUPPORTED)
  }
  const operationId = parseUuid(
    value.operation_id,
    'command.operation_id',
    issues
  )
  const wordId = parseUuid(value.word_id, 'command.word_id', issues)
  const expectedVersion = value.expected_content_version
  if (
    typeof expectedVersion !== 'number' ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    addIssue(
      issues,
      'command.expected_content_version',
      'must be a non-negative integer'
    )
  }
  return {
    protocol_version: DICTIONARY_CONTENT_PROTOCOL_VERSION,
    operation_id: operationId ?? '',
    word_id: wordId ?? '',
    expected_content_version:
      typeof expectedVersion === 'number' ? expectedVersion : 0,
  }
}

export const parseDictionaryContentCapability = (
  value: unknown
): DictionaryValidationResult<DictionaryContentCapability> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'capability', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  validateKeys(value, ['dictionary_content_protocol'], 'capability', issues)
  if (
    value.dictionary_content_protocol !== DICTIONARY_CONTENT_PROTOCOL_VERSION
  ) {
    addIssue(issues, 'capability.dictionary_content_protocol', IS_NOT_SUPPORTED)
  }
  return toResult(issues, {
    dictionary_content_protocol: DICTIONARY_CONTENT_PROTOCOL_VERSION,
  })
}

const COMMAND_FIELDS = [
  'protocol_version',
  'operation_id',
  'word_id',
  'expected_content_version',
  'kind',
]

const appendValidationIssues = <Value>(
  target: DictionaryValidationIssue[],
  result: DictionaryValidationResult<Value>
): Value | null => {
  if (result.success) return result.data
  result.issues.forEach(issue => addIssue(target, issue.path, issue.message))
  return null
}

const parseContentCommand = (
  value: UnknownRecord,
  kind: 'create-private' | 'detach' | 'resolve-conflict',
  issues: DictionaryValidationIssue[]
): DictionaryValidationResult<DictionaryContentCommand> => {
  validateKeys(value, [...COMMAND_FIELDS, 'content'], 'command', issues)
  const base = parseContentCommandBase(value, issues)
  const content = appendValidationIssues(
    issues,
    parseDictionaryContent(value.content)
  )
  return toResult(issues, {
    ...base,
    kind,
    content: content ?? ({} as DictionaryContent),
  })
}

const parseEditCommand = (
  value: UnknownRecord,
  issues: DictionaryValidationIssue[]
): DictionaryValidationResult<DictionaryContentCommand> => {
  validateKeys(value, [...COMMAND_FIELDS, 'overrides'], 'command', issues)
  const base = parseContentCommandBase(value, issues)
  const overrides = appendValidationIssues(
    issues,
    parseDictionaryContentOverrides(value.overrides)
  )
  return toResult(issues, {
    ...base,
    kind: 'edit-private',
    overrides: overrides ?? {},
  })
}

const parseReferenceCommand = (
  value: UnknownRecord,
  kind: 'link' | 'adopt-revision',
  issues: DictionaryValidationIssue[]
): DictionaryValidationResult<DictionaryContentCommand> => {
  validateKeys(
    value,
    [...COMMAND_FIELDS, 'reference', 'overrides'],
    'command',
    issues
  )
  const base = parseContentCommandBase(value, issues)
  const reference = appendValidationIssues(
    issues,
    parseDictionaryReference(value.reference)
  )
  const overrides = appendValidationIssues(
    issues,
    parseDictionaryContentOverrides(value.overrides)
  )
  return toResult(issues, {
    ...base,
    kind,
    reference: reference ?? { entry_id: '', revision_id: '' },
    overrides: overrides ?? {},
  })
}

export const parseDictionaryContentCommand = (
  value: unknown
): DictionaryValidationResult<DictionaryContentCommand> => {
  const issues: DictionaryValidationIssue[] = []
  if (!isRecord(value)) {
    addIssue(issues, 'command', MUST_BE_OBJECT)
    return { success: false, issues }
  }
  switch (value.kind) {
    case 'create-private':
    case 'detach':
    case 'resolve-conflict':
      return parseContentCommand(value, value.kind, issues)
    case 'edit-private':
      return parseEditCommand(value, issues)
    case 'link':
    case 'adopt-revision':
      return parseReferenceCommand(value, value.kind, issues)
    default:
      addIssue(issues, 'command.kind', IS_NOT_SUPPORTED)
      return { success: false, issues }
  }
}

export interface EffectiveDictionaryContentInput {
  reference: DictionaryReference | null
  revision: DictionaryRevision | null
  fallback_content: DictionaryContent | null
  overrides: DictionaryContentOverrides
}

export interface EffectiveDictionaryContent {
  source: DictionaryContentSource
  content: EffectiveDictionaryContentFields | null
  removed_fields: DictionaryContentField[]
}

export type EffectiveDictionaryContentFields = {
  [Field in DictionaryContentField]: DictionaryContent[Field] | null
}

const cloneContent = (
  content: DictionaryContent
): EffectiveDictionaryContentFields =>
  JSON.parse(JSON.stringify(content)) as EffectiveDictionaryContentFields

const hasMatchingPublishedReference = (
  reference: DictionaryReference | null,
  revision: DictionaryRevision | null
): revision is DictionaryRevision =>
  reference !== null &&
  revision !== null &&
  reference.entry_id === revision.entry_id &&
  reference.revision_id === revision.revision_id &&
  (revision.review_status === 'published' ||
    revision.review_status === 'retired')

export const resolveEffectiveDictionaryContent = (
  input: EffectiveDictionaryContentInput
): EffectiveDictionaryContent => {
  const hasPinnedRevision = hasMatchingPublishedReference(
    input.reference,
    input.revision
  )
  const revision = input.revision
  const base =
    hasPinnedRevision && revision !== null
      ? cloneContent(revision.content)
      : input.fallback_content === null
        ? null
        : cloneContent(input.fallback_content)
  if (base === null)
    return { source: 'missing', content: null, removed_fields: [] }

  const removedFields: DictionaryContentField[] = []
  const mutableBase = base as Record<DictionaryContentField, unknown>
  CONTENT_FIELDS.forEach(field => {
    const operation = input.overrides[field]
    if (!operation) return
    if (operation.op === 'remove') {
      mutableBase[field] = null
      removedFields.push(field)
      return
    }
    mutableBase[field] = operation.value
  })
  return {
    source: hasPinnedRevision ? 'pinned' : 'fallback',
    content: base,
    removed_fields: removedFields,
  }
}

export interface InheritedCefrInput {
  reference: DictionaryReference | null
  revision: DictionaryRevision | null
  overrides: DictionaryContentOverrides
  assessment: DictionaryCefrAssessment | null
}

export interface InheritedCefrResult {
  level: CefrLevel | null
  status: CefrAssessmentStatus
  reason:
    | 'inherited'
    | 'unlinked-or-missing-revision'
    | 'private-linguistic-override'
    | 'assessment-input-mismatch'
    | 'assessment-unavailable'
}

export const resolveInheritedCefr = (
  input: InheritedCefrInput
): InheritedCefrResult => {
  if (!hasMatchingPublishedReference(input.reference, input.revision)) {
    return {
      level: null,
      status: 'unknown',
      reason: 'unlinked-or-missing-revision',
    }
  }
  if (
    Object.keys(input.overrides).some(field =>
      LINGUISTIC_CONTENT_FIELDS.has(field as DictionaryContentField)
    )
  ) {
    return {
      level: null,
      status: 'unknown',
      reason: 'private-linguistic-override',
    }
  }
  const assessment = input.assessment
  if (
    assessment === null ||
    assessment.entry_id !== input.revision.entry_id ||
    assessment.input_sha256 !== input.revision.cefr_input_sha256
  ) {
    return {
      level: null,
      status: 'unknown',
      reason: 'assessment-input-mismatch',
    }
  }
  if (assessment.status === 'unknown' || assessment.cefr_level === null) {
    return { level: null, status: 'unknown', reason: 'assessment-unavailable' }
  }
  return {
    level: assessment.cefr_level,
    status: assessment.status,
    reason: 'inherited',
  }
}

const canonicalizeJson = (value: unknown): string => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('Cannot canonicalize a non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
      .join(',')}}`
  }
  throw new Error('Cannot canonicalize unsupported dictionary content')
}

export const canonicalizeCefrInput = (content: DictionaryContent): string => {
  const linguisticContent = Object.fromEntries(
    CONTENT_FIELDS.filter(field => LINGUISTIC_CONTENT_FIELDS.has(field)).map(
      field => [field, content[field]]
    )
  )
  return canonicalizeJson({
    assessment_schema_version: CEFR_INPUT_SCHEMA_VERSION,
    content: linguisticContent,
  })
}
