import {
  parseDictionaryContent,
  type DictionaryContent,
} from './shared-dictionary'

export const DICTIONARY_TRANSFER_SCHEMA_VERSION = 1 as const
export const MAX_DICTIONARY_TRANSFER_ENTRIES = 10_000

export interface DictionaryCollectionExport {
  schema_version: 1
  collection: { name: string }
  entries: { content: DictionaryContent }[]
}

export interface SharedDictionaryCollection {
  schema_version: 1
  collection: { collection_id: string; name: string }
  words: { word_id: string; created_at: string; content: DictionaryContent }[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key))
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)
const invalid = (): never => {
  throw new Error('Invalid dictionary collection transfer.')
}
const content = (value: unknown): DictionaryContent => {
  const parsed = parseDictionaryContent(value)
  return parsed.success ? parsed.data : invalid()
}

/** Self-contained private copies never depend on another owner's rows or pins. */
export function parseDictionaryCollectionExport(
  value: unknown
): DictionaryCollectionExport {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['schema_version', 'collection', 'entries']) ||
    value.schema_version !== 1 ||
    !isRecord(value.collection) ||
    !exactKeys(value.collection, ['name']) ||
    !nonEmpty(value.collection.name) ||
    !Array.isArray(value.entries) ||
    value.entries.length > MAX_DICTIONARY_TRANSFER_ENTRIES
  )
    return invalid()
  return {
    schema_version: 1,
    collection: { name: value.collection.name },
    entries: value.entries.map(entry => {
      if (!isRecord(entry) || !exactKeys(entry, ['content'])) return invalid()
      return { content: content(entry.content) }
    }),
  }
}

/** This projection exposes shared text only, without owner state or dictionary IDs. */
export function parseSharedDictionaryCollection(
  value: unknown
): SharedDictionaryCollection {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['schema_version', 'collection', 'words']) ||
    value.schema_version !== 1 ||
    !isRecord(value.collection) ||
    !exactKeys(value.collection, ['collection_id', 'name']) ||
    !uuid(value.collection.collection_id) ||
    !nonEmpty(value.collection.name) ||
    !Array.isArray(value.words) ||
    value.words.length > MAX_DICTIONARY_TRANSFER_ENTRIES
  )
    return invalid()
  const ids = new Set<string>()
  return {
    schema_version: 1,
    collection: {
      collection_id: value.collection.collection_id,
      name: value.collection.name,
    },
    words: value.words.map(word => {
      if (
        !isRecord(word) ||
        !exactKeys(word, ['word_id', 'created_at', 'content']) ||
        !uuid(word.word_id) ||
        ids.has(word.word_id) ||
        !nonEmpty(word.created_at)
      )
        return invalid()
      ids.add(word.word_id)
      return {
        word_id: word.word_id,
        created_at: word.created_at,
        content: content(word.content),
      }
    }),
  }
}
