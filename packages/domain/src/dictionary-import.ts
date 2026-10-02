import {
  parseDictionaryContent,
  parseDictionaryReference,
  type DictionaryContent,
  type DictionaryReference,
} from './shared-dictionary'

export type DictionaryImportSource =
  | { kind: 'private-copy'; content: DictionaryContent }
  | {
      kind: 'official-pack'
      pack_id: string
      version: string
      pack_entry_id: string
      manifest_sha256: string
      reference: DictionaryReference | null
      content: DictionaryContent
    }

export interface DictionaryImportIntent {
  protocol_version: 1
  operation_id: string
  word_id: string
  collection_id: string
  source: DictionaryImportSource
}

interface DictionaryImportReceiptIdentity {
  protocol_version: 1
  operation_id: string
  word_id: string
  idempotent: boolean
}

export type DictionaryImportReceipt = DictionaryImportReceiptIdentity &
  (
    | { outcome: 'inserted'; existing_word_id: null }
    | { outcome: 'identity-conflict'; existing_word_id: string }
  )

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).length === expected.length &&
  expected.every(key => Object.hasOwn(value, key))
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const invalid = (): never => {
  throw new Error('Invalid dictionary import intent')
}

/** Persist only immutable import input, never a mutable learning snapshot. */
export function parseDictionaryImportIntent(
  value: unknown
): DictionaryImportIntent {
  if (
    !record(value) ||
    !keys(value, [
      'protocol_version',
      'operation_id',
      'word_id',
      'collection_id',
      'source',
    ]) ||
    value.protocol_version !== 1 ||
    !uuid(value.operation_id) ||
    !uuid(value.word_id) ||
    !uuid(value.collection_id) ||
    !record(value.source)
  )
    return invalid()
  const source = value.source
  const content = parseDictionaryContent(source.content)
  if (!content.success) return invalid()
  let parsedSource: DictionaryImportSource
  if (source.kind === 'private-copy' && keys(source, ['kind', 'content'])) {
    parsedSource = { kind: 'private-copy', content: content.data }
  } else if (
    source.kind === 'official-pack' &&
    keys(source, [
      'kind',
      'pack_id',
      'version',
      'pack_entry_id',
      'manifest_sha256',
      'reference',
      'content',
    ]) &&
    text(source.pack_id) &&
    text(source.version) &&
    text(source.pack_entry_id) &&
    typeof source.manifest_sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(source.manifest_sha256)
  ) {
    const reference =
      source.reference === null
        ? null
        : parseDictionaryReference(source.reference)
    if (reference && !reference.success) return invalid()
    parsedSource = {
      kind: 'official-pack',
      pack_id: source.pack_id,
      version: source.version,
      pack_entry_id: source.pack_entry_id,
      manifest_sha256: source.manifest_sha256,
      reference: reference?.data ?? null,
      content: content.data,
    }
  } else return invalid()
  return {
    protocol_version: 1,
    operation_id: value.operation_id,
    word_id: value.word_id,
    collection_id: value.collection_id,
    source: parsedSource,
  }
}

export function parseDictionaryImportReceipt(
  value: unknown,
  intent: DictionaryImportIntent
): DictionaryImportReceipt {
  if (
    !record(value) ||
    !keys(value, [
      'protocol_version',
      'operation_id',
      'word_id',
      'outcome',
      'existing_word_id',
      'idempotent',
    ]) ||
    value.protocol_version !== 1 ||
    value.operation_id !== intent.operation_id ||
    value.word_id !== intent.word_id ||
    typeof value.idempotent !== 'boolean' ||
    !(
      (value.outcome === 'inserted' && value.existing_word_id === null) ||
      (value.outcome === 'identity-conflict' &&
        uuid(value.existing_word_id) &&
        value.existing_word_id !== intent.word_id)
    )
  )
    throw new Error('Invalid dictionary import receipt')
  return value as unknown as DictionaryImportReceipt
}
