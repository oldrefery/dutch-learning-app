import dutchA1PackAsset from '@woordenaar/content'
import type { Word, WordConjugation, WordExample } from '@/types/database'
import { isValidExpressionType } from '@/types/ExpressionTypes'
import type {
  StarterPackEntry,
  StarterPackManifest,
  StarterPackValidationIssue,
  StarterPackValidationResult,
} from '@/types/StarterPackTypes'
import { STARTER_PACK_SCHEMA_VERSION } from '@/types/StarterPackTypes'
import type { ImportPreviewData, ImportableWord } from '@/types/ImportTypes'

const OFFICIAL_PACK_MIN_ENTRIES = 50
const OFFICIAL_PACK_MAX_ENTRIES = 100
export const OFFICIAL_DUTCH_A1_PACK_SIZE = dutchA1PackAsset.entries.length
const MUST_BE_OBJECT = 'must be an object'
const MUST_BE_NON_EMPTY_STRING = 'must be a non-empty string'
const MUST_BE_NULLABLE_STRING = 'must be a non-empty string or null'
const FORBIDDEN_ENTRY_FIELDS = [
  'user_id',
  'collection_id',
  'interval_days',
  'repetition_count',
  'easiness_factor',
  'next_review_date',
  'last_reviewed_at',
]

type UnknownRecord = Record<string, unknown>

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
  issues: StarterPackValidationIssue[],
  path: string,
  message: string
): void => {
  issues.push({ path, message })
}

const validateOptionalBoolean = (
  value: unknown,
  path: string,
  issues: StarterPackValidationIssue[]
): void => {
  if (value !== undefined && typeof value !== 'boolean') {
    addIssue(issues, path, 'must be a boolean when provided')
  }
}

const validateTranslations = (
  value: unknown,
  path: string,
  issues: StarterPackValidationIssue[]
): void => {
  if (!isRecord(value)) {
    addIssue(issues, path, MUST_BE_OBJECT)
    return
  }

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
  issues: StarterPackValidationIssue[]
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
  issues: StarterPackValidationIssue[]
): void => {
  if (value === undefined || value === null) return
  if (!isRecord(value)) {
    addIssue(issues, path, `${MUST_BE_OBJECT} or null`)
    return
  }

  ;(['present', 'simple_past', 'past_participle'] as const).forEach(field => {
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
  issues: StarterPackValidationIssue[]
): void => {
  const path = `entries[${index}]`
  if (!isRecord(value)) {
    addIssue(issues, path, MUST_BE_OBJECT)
    return
  }

  if (!isNonEmptyString(value.entry_id)) {
    addIssue(issues, `${path}.entry_id`, MUST_BE_NON_EMPTY_STRING)
  }
  if (!isNonEmptyString(value.dutch_lemma)) {
    addIssue(issues, `${path}.dutch_lemma`, MUST_BE_NON_EMPTY_STRING)
  }
  if (!isNonEmptyString(value.part_of_speech)) {
    addIssue(issues, `${path}.part_of_speech`, MUST_BE_NON_EMPTY_STRING)
  }

  validateTranslations(value.translations, `${path}.translations`, issues)
  validateExamples(value.examples, `${path}.examples`, issues)
  validateConjugation(value.conjugation, `${path}.conjugation`, issues)
  ;['is_irregular', 'is_reflexive', 'is_expression', 'is_separable'].forEach(
    field => validateOptionalBoolean(value[field], `${path}.${field}`, issues)
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
      !isValidExpressionType(value.expression_type))
  ) {
    addIssue(issues, `${path}.expression_type`, 'is not supported')
  }

  ;[
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
        'must not be stored in starter content'
      )
    }
  })
}

const validateManifestMetadata = (
  value: UnknownRecord,
  issues: StarterPackValidationIssue[]
): void => {
  if (value.schema_version !== STARTER_PACK_SCHEMA_VERSION) {
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

const validateLicense = (
  value: unknown,
  issues: StarterPackValidationIssue[]
): void => {
  if (!isRecord(value)) {
    addIssue(issues, 'license', MUST_BE_OBJECT)
    return
  }
  if (!isNonEmptyString(value.name)) {
    addIssue(issues, 'license.name', MUST_BE_NON_EMPTY_STRING)
  }
  if (!isNullableString(value.url)) {
    addIssue(issues, 'license.url', MUST_BE_NULLABLE_STRING)
  }
  if (!isNonEmptyString(value.notes)) {
    addIssue(issues, 'license.notes', MUST_BE_NON_EMPTY_STRING)
  }
}

const validateProvenance = (
  value: unknown,
  issues: StarterPackValidationIssue[]
): void => {
  if (!isRecord(value)) {
    addIssue(issues, 'provenance', MUST_BE_OBJECT)
    return
  }
  if (
    value.origin !== 'original-project-content' &&
    value.origin !== 'existing-project-library'
  ) {
    addIssue(
      issues,
      'provenance.origin',
      'must identify an approved project content source'
    )
  }
  if (!isNonEmptyString(value.notes)) {
    addIssue(issues, 'provenance.notes', MUST_BE_NON_EMPTY_STRING)
  }
  if (!isStringArray(value.excluded_sources, false)) {
    addIssue(
      issues,
      'provenance.excluded_sources',
      'must list excluded competitor and community-deck sources'
    )
  }

  if (value.origin === 'existing-project-library') {
    ;['source_snapshot_at', 'selection_method'].forEach(field => {
      if (!isNonEmptyString(value[field])) {
        addIssue(issues, `provenance.${field}`, MUST_BE_NON_EMPTY_STRING)
      }
    })
    ;['source_card_count', 'source_unique_semantic_count'].forEach(field => {
      if (
        typeof value[field] !== 'number' ||
        !Number.isInteger(value[field]) ||
        value[field] <= 0
      ) {
        addIssue(issues, `provenance.${field}`, 'must be a positive integer')
      }
    })
  }
}

const validateManifestPolicy = (
  value: UnknownRecord,
  issues: StarterPackValidationIssue[]
): void => {
  validateLicense(value.license, issues)
  validateProvenance(value.provenance, issues)
}

const validateContentReview = (
  value: unknown,
  issues: StarterPackValidationIssue[]
): void => {
  if (!isRecord(value)) {
    addIssue(issues, 'content_review', MUST_BE_OBJECT)
    return
  }

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

const validateUniqueEntries = (
  entries: unknown[],
  issues: StarterPackValidationIssue[]
): void => {
  const ids = new Set<string>()
  entries.forEach((entry, index) => {
    if (!isRecord(entry) || !isNonEmptyString(entry.entry_id)) return
    if (ids.has(entry.entry_id)) {
      addIssue(issues, `entries[${index}].entry_id`, 'must be unique')
    }
    ids.add(entry.entry_id)
  })
}

export const validateStarterPackManifest = (
  value: unknown
): StarterPackValidationResult => {
  const issues: StarterPackValidationIssue[] = []

  if (!isRecord(value)) {
    return {
      success: false,
      issues: [{ path: 'manifest', message: MUST_BE_OBJECT }],
    }
  }

  validateManifestMetadata(value, issues)
  validateManifestPolicy(value, issues)
  validateContentReview(value.content_review, issues)

  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    addIssue(issues, 'entries', 'must contain at least one entry')
  } else {
    value.entries.forEach((entry, index) => validateEntry(entry, index, issues))
    validateUniqueEntries(value.entries, issues)
  }

  if (issues.length > 0) {
    return { success: false, issues }
  }

  return { success: true, data: value as unknown as StarterPackManifest }
}

export class StarterPackValidationError extends Error {
  constructor(readonly issues: StarterPackValidationIssue[]) {
    super(
      `Starter pack validation failed: ${issues
        .map(issue => `${issue.path} ${issue.message}`)
        .join('; ')}`
    )
    this.name = 'StarterPackValidationError'
  }
}

const toPreviewWord = (
  entry: StarterPackEntry,
  createdAt: string
): ImportableWord => ({
  word_id: entry.entry_id,
  collection_id: null,
  dutch_lemma: entry.dutch_lemma,
  dutch_original: entry.dutch_original ?? entry.dutch_lemma,
  part_of_speech: entry.part_of_speech,
  is_irregular: entry.is_irregular ?? false,
  is_reflexive: entry.is_reflexive ?? false,
  is_expression: entry.is_expression ?? false,
  expression_type: entry.expression_type ?? null,
  is_separable: entry.is_separable ?? false,
  prefix_part: entry.prefix_part ?? null,
  root_verb: entry.root_verb ?? null,
  article: entry.article ?? null,
  plural: entry.plural ?? null,
  register: entry.register ?? 'neutral',
  translations: entry.translations,
  examples: (entry.examples ?? []) as WordExample[],
  synonyms: entry.synonyms ?? [],
  antonyms: entry.antonyms ?? [],
  conjugation: (entry.conjugation ?? null) as WordConjugation | null,
  preposition: entry.preposition ?? null,
  image_url: null,
  tts_url: null,
  analysis_notes: entry.analysis_notes ?? null,
  created_at: createdAt,
  updated_at: createdAt,
})

export const loadOfficialDutchA1Pack = (): StarterPackManifest => {
  const result = validateStarterPackManifest(dutchA1PackAsset)
  if (!result.success) {
    throw new StarterPackValidationError(result.issues)
  }

  if (
    result.data.entries.length < OFFICIAL_PACK_MIN_ENTRIES ||
    result.data.entries.length > OFFICIAL_PACK_MAX_ENTRIES
  ) {
    throw new StarterPackValidationError([
      {
        path: 'entries',
        message: `official pack must contain ${OFFICIAL_PACK_MIN_ENTRIES}-${OFFICIAL_PACK_MAX_ENTRIES} entries`,
      },
    ])
  }

  return result.data
}

export const getStarterPackPreview = (
  manifest: StarterPackManifest
): ImportPreviewData => ({
  collection: {
    collection_id: manifest.pack_id,
    name: manifest.title,
    word_count: manifest.entries.length,
  },
  words: manifest.entries.map(entry =>
    toPreviewWord(entry, manifest.created_at)
  ),
})

export const createStarterPackImportWords = (
  manifest: StarterPackManifest,
  entryIds: string[],
  reviewDate: string
): Partial<Word>[] => {
  const selectedIds = new Set(entryIds)

  return manifest.entries
    .filter(entry => selectedIds.has(entry.entry_id))
    .map(entry => {
      const previewWord = toPreviewWord(entry, manifest.created_at)
      const {
        word_id: _packEntryId,
        collection_id: _packCollectionId,
        created_at: _createdAt,
        updated_at: _updatedAt,
        ...content
      } = previewWord

      return {
        ...content,
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: reviewDate,
        last_reviewed_at: null,
      }
    })
}

export const isStarterPackReleaseReady = (
  manifest: StarterPackManifest
): boolean => manifest.content_review.status === 'approved'

export const starterPackService = {
  loadOfficialDutchA1Pack,
  getStarterPackPreview,
  createStarterPackImportWords,
  isStarterPackReleaseReady,
}
