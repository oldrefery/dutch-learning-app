import type { Word } from '@/types/database'
import { parseDictionarySequence } from '@woordenaar/domain'

type PersonalWord = Pick<
  Word,
  | 'word_id'
  | 'user_id'
  | 'collection_id'
  | 'dutch_lemma'
  | 'part_of_speech'
  | 'article'
  | 'created_at'
  | 'updated_at'
  | 'interval_days'
  | 'repetition_count'
  | 'easiness_factor'
  | 'next_review_date'
  | 'last_reviewed_at'
>

export type PersonalMetadataRow = PersonalWord & {
  deleted_at: string | null
  dictionary_content_mode: 'follow' | 'legacy'
  dictionary_entry_id: string | null
  dictionary_revision_id: string | null
  content_version: string
  legacyWord?: Word
  bootstrapWord?: Word
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value)
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
const nullableId = (value: unknown) => value === null || uuid(value)
const nullableTimestamp = (value: unknown) => value === null || timestamp(value)

const invalid = (): never => {
  throw new Error('Invalid personal metadata row')
}

export function parsePersonalMetadata(
  value: unknown,
  owner: string
): PersonalMetadataRow {
  if (!object(value) || !object(value.payload)) return invalid()
  const row = value.payload
  if (
    row.user_id !== owner ||
    !uuid(row.word_id) ||
    value.word_id !== row.word_id ||
    !timestamp(row.updated_at) ||
    value.updated_at !== row.updated_at ||
    !timestamp(row.created_at) ||
    !nullableTimestamp(row.deleted_at) ||
    !nullableTimestamp(row.last_reviewed_at) ||
    !nullableId(row.collection_id) ||
    typeof row.dutch_lemma !== 'string' ||
    !row.dutch_lemma.trim() ||
    (row.part_of_speech !== null && typeof row.part_of_speech !== 'string') ||
    (row.article !== null && typeof row.article !== 'string') ||
    !Number.isInteger(row.interval_days) ||
    !Number.isInteger(row.repetition_count) ||
    typeof row.easiness_factor !== 'number' ||
    !Number.isFinite(row.easiness_factor) ||
    typeof row.next_review_date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.next_review_date) ||
    !parseDictionarySequence(row.content_version).success
  )
    return invalid()
  const mode = row.dictionary_content_mode
  if (
    (mode !== 'follow' && mode !== 'legacy') ||
    !nullableId(row.dictionary_entry_id) ||
    !nullableId(row.dictionary_revision_id) ||
    (mode === 'follow' &&
      (!row.dictionary_entry_id || !row.dictionary_revision_id))
  )
    return invalid()
  if (mode === 'legacy' && row.deleted_at === null) {
    // Legacy payload comes from the same words composite as the old reader.
    if (!object(row.translations)) return invalid()
    return {
      ...row,
      legacyWord: {
        ...row,
        synonyms: row.synonyms ?? [],
        antonyms: row.antonyms ?? [],
      },
    } as unknown as PersonalMetadataRow
  }
  if ('translations' in row || 'examples' in row) return invalid()
  return row as unknown as PersonalMetadataRow
}

// Keep sub-millisecond precision for timestamptz page boundaries and replays.
export const comparePersonalTimestamps = (
  left: string,
  right: string
): number => {
  const subMillis = (value: string) =>
    Number((value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6))
  return (
    Date.parse(left) - Date.parse(right) || subMillis(left) - subMillis(right)
  )
}

// A parsed legacy row also carries lexical fields on the outer object.
// Explicit defaults reproduce the old sparse copy during recovery.
export const personalStorageWord = (row: PersonalMetadataRow): Word =>
  row.legacyWord ?? {
    ...row,
    dutch_original: null,
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    expression_type: null,
    is_separable: false,
    prefix_part: null,
    root_verb: null,
    plural: null,
    register: null,
    translations: { en: [] },
    examples: null,
    synonyms: [],
    antonyms: [],
    conjugation: null,
    preposition: null,
    image_url: null,
    tts_url: null,
    analysis_notes: null,
    usage_notes: null,
  }

// A complete personal copy is required before a following row becomes visible to
// older readers. It is independent of published-revision availability.
export function requirePersonalBootstrap(
  value: unknown,
  row: PersonalMetadataRow
): Word {
  if (
    !object(value) ||
    !object(value.translations) ||
    value.deleted_at !== null
  )
    throw new Error('Complete personal bootstrap is unavailable')
  for (const key of [
    'word_id',
    'user_id',
    'collection_id',
    'dutch_lemma',
    'part_of_speech',
    'article',
    'dictionary_content_mode',
    'dictionary_entry_id',
    'dictionary_revision_id',
  ] as const) {
    if (value[key] !== row[key])
      throw new Error('Personal bootstrap changed during read')
  }
  if (
    typeof value.updated_at !== 'string' ||
    comparePersonalTimestamps(value.updated_at, row.updated_at) !== 0
  )
    throw new Error('Personal bootstrap changed during read')
  const parsed = parsePersonalMetadata(
    {
      word_id: row.word_id,
      updated_at: row.updated_at,
      payload: {
        ...value,
        updated_at: row.updated_at,
        content_version: row.content_version,
        dictionary_content_mode: 'legacy',
      },
    },
    row.user_id
  )
  if (!parsed.legacyWord)
    throw new Error('Complete personal bootstrap is unavailable')
  return { ...parsed.legacyWord, ...row, bootstrapWord: undefined } as Word
}
