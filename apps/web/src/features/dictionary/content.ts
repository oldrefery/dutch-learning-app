import type { Database } from '@woordenaar/supabase-contracts'
import {
  CEFR_LEVELS,
  parseDictionaryReference,
  parseDictionaryReadContent,
} from '@woordenaar/domain'
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

interface DictionaryMetadataBase {
  availableRevision?: DictionaryReference
  reference: DictionaryReference | null
  cefr: {
    level: CefrLevel | null
    status: CefrAssessmentStatus
    confidence: number | null
  }
}

export type DictionaryCardMetadata = DictionaryMetadataBase &
  (
    | { contentVersion: number; source: 'pinned' | 'fallback'; mode?: 'legacy' }
    | {
        protocolVersion: 2
        contentVersion: string
        source: 'following' | 'pinned' | 'fallback'
        mode: 'legacy' | 'follow'
        adoptedRevisionId: string | null
        headSequence: string | null
        watermark: string
      }
  )

export type EffectiveCard = DictionaryCardMetadata & {
  wordId: string
  content: ContentProjection
}

const invalid = (): never => {
  throw new Error('Could not load dictionary content. Please retry.')
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
// Normalize only display defaults; raw removals remain validated at the wire boundary.
export const projectDictionaryContent = (value: unknown): ContentProjection => {
  const parsed = parseDictionaryReadContent(value)
  if (!parsed.success) return invalid()
  const content = parsed.data
  return {
    ...content,
    translations: content.translations ?? { en: [], ru: [] },
    examples: content.examples ?? [],
    synonyms: content.synonyms ?? [],
    antonyms: content.antonyms ?? [],
    tts_url: content.tts_url ?? '',
  }
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
    const content = projectDictionaryContent(row.content)
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
