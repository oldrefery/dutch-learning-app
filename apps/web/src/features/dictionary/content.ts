import type { Database, Json } from '@woordenaar/supabase-contracts'
import { CEFR_LEVELS, parseDictionaryReference } from '@woordenaar/domain'
import type {
  CefrLevel,
  CefrAssessmentStatus,
  DictionaryReference,
} from '@woordenaar/domain'

const textFields = [
  'dutch_original',
  'part_of_speech',
  'article',
  'expression_type',
  'prefix_part',
  'root_verb',
  'plural',
  'register',
  'preposition',
  'analysis_notes',
  'image_url',
  'tts_url',
] as const
const booleanFields = [
  'is_irregular',
  'is_reflexive',
  'is_expression',
  'is_separable',
] as const
const jsonFields = ['translations', 'conjugation', 'usage_notes'] as const
const arrayFields = ['examples', 'synonyms', 'antonyms'] as const
const contentFields = [
  'dutch_lemma',
  ...textFields,
  ...booleanFields,
  ...jsonFields,
  ...arrayFields,
] as const
type ContentField = (typeof contentFields)[number]
type WordRow = Database['public']['Tables']['words']['Row']
type ContentProjection = Pick<WordRow, ContentField>

export interface DictionaryCardMetadata {
  availableRevision?: DictionaryReference
  contentVersion: number
  reference: DictionaryReference | null
  source: 'pinned' | 'fallback'
  cefr: {
    level: CefrLevel | null
    status: CefrAssessmentStatus
    confidence: number | null
  }
}

export interface EffectiveCard extends DictionaryCardMetadata {
  wordId: string
  content: ContentProjection
}

const invalid = (): never => {
  throw new Error('Could not load dictionary content. Please retry.')
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isJson = (value: unknown): value is Json =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (Array.isArray(value)
    ? value.every(isJson)
    : isRecord(value) && Object.values(value).every(isJson))

// Validate the read projection, which also contains legacy/private JSON. The
// stricter canonical publication validator must not reject older private cards.
const parseContent = (value: unknown): ContentProjection => {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== contentFields.length ||
    !contentFields.every(field => Object.hasOwn(value, field)) ||
    typeof value.dutch_lemma !== 'string' ||
    !value.dutch_lemma.trim()
  )
    return invalid()
  for (const field of textFields) {
    if (value[field] !== null && typeof value[field] !== 'string')
      return invalid()
  }
  for (const field of booleanFields) {
    if (value[field] !== null && typeof value[field] !== 'boolean')
      return invalid()
  }
  for (const field of jsonFields) if (!isJson(value[field])) return invalid()
  for (const field of arrayFields) {
    const values = value[field]
    if (values !== null && (!Array.isArray(values) || !values.every(isJson)))
      return invalid()
    if (
      field !== 'examples' &&
      Array.isArray(values) &&
      !values.every(item => typeof item === 'string')
    )
      return invalid()
  }
  return {
    ...value,
    translations: value.translations ?? { en: [], ru: [] },
    examples: value.examples ?? [],
    synonyms: value.synonyms ?? [],
    antonyms: value.antonyms ?? [],
    tts_url: value.tts_url ?? '',
  } as ContentProjection
}

export const parseEffectiveCards = (
  value: unknown
): Map<string, EffectiveCard> => {
  if (
    !isRecord(value) ||
    value.protocol_version !== 1 ||
    !Array.isArray(value.cards)
  )
    return invalid()
  const cards = new Map<string, EffectiveCard>()
  for (const row of value.cards) {
    if (
      !isRecord(row) ||
      typeof row.word_id !== 'string' ||
      !row.word_id ||
      cards.has(row.word_id) ||
      !Number.isSafeInteger(row.content_version) ||
      typeof row.content_version !== 'number' ||
      row.content_version < 0 ||
      (row.source !== 'pinned' && row.source !== 'fallback') ||
      !isRecord(row.cefr)
    )
      return invalid()
    const reference =
      row.reference === null ? null : parseDictionaryReference(row.reference)
    if (reference !== null && !reference.success) return invalid()
    if ((row.source === 'pinned') !== (reference !== null)) return invalid()
    const { level, status, confidence } = row.cefr
    if (
      (level !== null && !CEFR_LEVELS.includes(level as CefrLevel)) ||
      !['unknown', 'estimated', 'reviewed'].includes(String(status)) ||
      (status === 'unknown') !== (level === null) ||
      (confidence !== null &&
        (typeof confidence !== 'number' ||
          !Number.isFinite(confidence) ||
          confidence < 0 ||
          confidence > 1))
    )
      return invalid()
    const content = parseContent(row.content)
    if (
      !Array.isArray(row.removed_fields) ||
      row.removed_fields.some(
        field =>
          !contentFields.includes(field as ContentField) ||
          !isRecord(row.content) ||
          row.content[field] !== null
      )
    )
      return invalid()
    cards.set(row.word_id, {
      wordId: row.word_id,
      content,
      contentVersion: row.content_version,
      reference: reference?.data ?? null,
      source: row.source,
      cefr: {
        level: level as CefrLevel | null,
        status: status as CefrAssessmentStatus,
        confidence: confidence as number | null,
      },
    })
  }
  return cards
}

export const applyEffectiveCards = <Row extends { word_id: string }>(
  rows: readonly Row[],
  cards: ReadonlyMap<string, EffectiveCard>
): (Row & ContentProjection & { dictionary: DictionaryCardMetadata })[] => {
  if (cards.size !== new Set(rows.map(row => row.word_id)).size)
    return invalid()
  return rows.map(row => {
    const card = cards.get(row.word_id)
    if (!card) return invalid()
    const { content, wordId, ...dictionary } = card
    void wordId
    // Content is a validated whitelist: identity, ownership and learning fields
    // can only come from the personal row, never the content response.
    return { ...row, ...content, dictionary }
  })
}
