import {
  getSemanticWordKey,
  MAX_DICTIONARY_TRANSFER_ENTRIES,
  parseDictionaryCollectionExport,
  type DictionaryCollectionExport,
} from '@woordenaar/domain'
import {
  isSharedResourceId,
  type ExistingSharedImportWord,
} from './shared-collection-domain'

// Match the mobile clipboard limit. The request also carries selection metadata.
export const MAX_TRANSFER_TEXT_LENGTH = 10_000_000
export const MAX_TRANSFER_REQUEST_BYTES = MAX_TRANSFER_TEXT_LENGTH * 3 + 100_000
export const TRANSFER_ENDPOINT = '/api/dictionary-transfer'

export type TransferCommand =
  | { kind: 'export'; ownerId: string; collectionId: string }
  | {
      kind: 'import'
      ownerId: string
      collectionId: string
      document: DictionaryCollectionExport
      selectedIndexes: number[]
    }

export type TransferReply =
  | {
      status: 'exported'
      ownerId: string
      document: DictionaryCollectionExport
    }
  | {
      status: 'saved'
      ownerId: string
      collectionId: string
      collectionName: string
      savedCount: number | null
      skippedCount: number
      cacheRefreshed: boolean
    }
  | { status: 'error' | 'uncertain'; message: string }

export interface TransferPreviewWord {
  index: number
  lemma: string
  translation: string
  duplicate: boolean
  duplicateCollection: string | null
}

export const isTransferRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key))

const invalid = (): never => {
  throw new Error('Invalid dictionary transfer request.')
}

export function parseTransferText(text: string): DictionaryCollectionExport {
  if (text.length > MAX_TRANSFER_TEXT_LENGTH)
    throw new Error('This JSON export is too large to paste.')
  try {
    return parseDictionaryCollectionExport(JSON.parse(text) as unknown)
  } catch {
    throw new Error('Paste a valid schema-v1 JSON collection export.')
  }
}

export function validateTransferDocument(value: unknown) {
  const document = parseDictionaryCollectionExport(value)
  if (JSON.stringify(document).length > MAX_TRANSFER_TEXT_LENGTH)
    throw new Error('This JSON export is too large to transfer.')
  return document
}

export function parseTransferCommand(value: unknown): TransferCommand {
  if (
    !isTransferRecord(value) ||
    typeof value.ownerId !== 'string' ||
    !isSharedResourceId(value.ownerId) ||
    typeof value.collectionId !== 'string' ||
    !isSharedResourceId(value.collectionId)
  )
    return invalid()
  const identity = { ownerId: value.ownerId, collectionId: value.collectionId }
  if (
    value.kind === 'export' &&
    hasKeys(value, ['kind', 'ownerId', 'collectionId'])
  )
    return { kind: 'export', ...identity }
  if (
    value.kind !== 'import' ||
    !hasKeys(value, [
      'kind',
      'ownerId',
      'collectionId',
      'document',
      'selectedIndexes',
    ])
  )
    return invalid()
  const document = validateTransferDocument(value.document)
  const indexes = value.selectedIndexes
  if (
    !Array.isArray(indexes) ||
    indexes.length === 0 ||
    indexes.length > MAX_DICTIONARY_TRANSFER_ENTRIES ||
    indexes.some(
      index =>
        typeof index !== 'number' ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= document.entries.length
    ) ||
    new Set(indexes).size !== indexes.length
  )
    return invalid()
  return {
    kind: 'import',
    ...identity,
    document,
    selectedIndexes: indexes as number[],
  }
}

export const transferContentKey = (
  content: DictionaryCollectionExport['entries'][number]['content']
) =>
  getSemanticWordKey(
    content.dutch_lemma,
    content.part_of_speech,
    content.article
  )

export function buildTransferPreview(
  document: DictionaryCollectionExport,
  existingWords: ExistingSharedImportWord[]
): TransferPreviewWord[] {
  const keys = new Map(
    existingWords.map(word => [
      getSemanticWordKey(word.dutchLemma, word.partOfSpeech, word.article),
      word.collectionName,
    ])
  )
  return document.entries.map(({ content }, index) => {
    const key = transferContentKey(content)
    const duplicate = keys.has(key)
    const duplicateCollection = duplicate ? (keys.get(key) ?? null) : null
    if (!duplicate) keys.set(key, 'this export')
    return {
      index,
      lemma: content.dutch_lemma,
      translation: content.translations.en[0] ?? 'No English translation',
      duplicate,
      duplicateCollection,
    }
  })
}

const count = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_DICTIONARY_TRANSFER_ENTRIES

export function parseTransferReply(value: unknown): TransferReply {
  if (!isTransferRecord(value)) return invalid()
  if (
    (value.status === 'error' || value.status === 'uncertain') &&
    typeof value.message === 'string'
  )
    return { status: value.status, message: value.message }
  if (typeof value.ownerId !== 'string' || !isSharedResourceId(value.ownerId))
    return invalid()
  if (value.status === 'exported')
    return {
      status: 'exported',
      ownerId: value.ownerId,
      document: validateTransferDocument(value.document),
    }
  if (
    value.status !== 'saved' ||
    typeof value.collectionId !== 'string' ||
    !isSharedResourceId(value.collectionId) ||
    typeof value.collectionName !== 'string' ||
    !(value.savedCount === null || count(value.savedCount)) ||
    !count(value.skippedCount) ||
    typeof value.cacheRefreshed !== 'boolean'
  )
    return invalid()
  return {
    status: 'saved',
    ownerId: value.ownerId,
    collectionId: value.collectionId,
    collectionName: value.collectionName,
    savedCount: value.savedCount,
    skippedCount: value.skippedCount,
    cacheRefreshed: value.cacheRefreshed,
  }
}

export async function requestDictionaryTransfer(command: TransferCommand) {
  const response = await fetch(TRANSFER_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  })
  const result = parseTransferReply((await response.json()) as unknown)
  if (
    (result.status === 'saved' || result.status === 'exported') &&
    (result.ownerId !== command.ownerId || !response.ok)
  )
    return invalid()
  return result
}
