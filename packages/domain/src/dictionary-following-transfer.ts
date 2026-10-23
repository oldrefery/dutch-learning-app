import {
  parseDictionaryCollectionExportV2,
  parseDictionaryImportIntentV2,
  parseSharedDictionaryCollectionV2,
  type DictionaryCollectionExportV2,
  type DictionaryImportIntentV2,
} from './dictionary-following-import'
import { requireFollowingImportOwner } from './dictionary-following-import-journal'
import {
  parseDictionaryRevision,
  type DictionaryRevision,
} from './shared-dictionary'

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
export interface FollowingTransferPlan {
  document: DictionaryCollectionExportV2
  intents: { index: number; intent: DictionaryImportIntentV2 }[]
  review: {
    index: number
    reason: 'unresolved-reference' | 'content-difference'
  }[]
}

export interface FollowingOfficialPack {
  pack_id: string
  version: string
  manifest_sha256: string
  entry_ids: string[]
}

export function parseFollowingOfficialPack(
  value: unknown,
  count: number
): FollowingOfficialPack {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid following official pack')
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).length !== 4 ||
    !['pack_id', 'version', 'manifest_sha256', 'entry_ids'].every(key =>
      Object.hasOwn(row, key)
    ) ||
    ![row.pack_id, row.version].every(
      item => typeof item === 'string' && item.trim() && item.length <= 200
    ) ||
    typeof row.manifest_sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(row.manifest_sha256) ||
    !Array.isArray(row.entry_ids) ||
    row.entry_ids.length !== count ||
    new Set(row.entry_ids).size !== count ||
    row.entry_ids.some(
      item => typeof item !== 'string' || !item.trim() || item.length > 200
    )
  )
    throw new Error('Invalid following official pack')
  return {
    pack_id: row.pack_id as string,
    version: row.version as string,
    manifest_sha256: row.manifest_sha256,
    entry_ids: (row.entry_ids as string[]).slice(),
  }
}

export interface FollowingSharedCollection {
  share_token: string
  collection_id: string
  word_ids: string[]
}

export function parseFollowingSharedCollection(
  value: unknown,
  count: number
): FollowingSharedCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid following shared collection')
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).length !== 3 ||
    !['share_token', 'collection_id', 'word_ids'].every(key =>
      Object.hasOwn(row, key)
    ) ||
    !Array.isArray(row.word_ids) ||
    row.word_ids.length !== count ||
    new Set(row.word_ids).size !== count
  )
    throw new Error('Invalid following shared collection')
  return {
    share_token: requireFollowingImportOwner(row.share_token),
    collection_id: requireFollowingImportOwner(row.collection_id),
    word_ids: row.word_ids.map(requireFollowingImportOwner),
  }
}

/** The token is supplied explicitly to the v2 reader. Its response contains
 * original content and source identities, never the source owner's learning. */
export function sharedCollectionFollowingSource(
  shareToken: string,
  value: unknown
) {
  const shared = parseSharedDictionaryCollectionV2(value)
  return {
    document: parseDictionaryCollectionExportV2({
      schema_version: 2,
      collection: { name: shared.collection.name },
      entries: shared.words.map(({ content, shared_reference }) => ({
        content,
        shared_reference,
      })),
    }),
    shared_collection: parseFollowingSharedCollection(
      {
        share_token: shareToken,
        collection_id: shared.collection.collection_id,
        word_ids: shared.words.map(word => word.word_id),
      },
      shared.words.length
    ),
  }
}

export function verifySharedCollectionFollowingSource(
  shareToken: string,
  original: unknown,
  current: unknown
) {
  const saved = sharedCollectionFollowingSource(shareToken, original)
  const fresh = sharedCollectionFollowingSource(shareToken, current)
  if (canonical(saved) !== canonical(fresh))
    throw new Error('Shared collection changed; reload before preparing')
  return saved
}

/** Hints and spelling never establish identity. Preserve the complete original
 * document; only exact immutable published content can propose an adoption. */
export function planDictionaryFollowingTransfer(ports: {
  document: unknown
  collectionId: string
  selectedIndexes: readonly number[]
  revisions: readonly DictionaryRevision[]
  createId: () => string
  officialPack?: FollowingOfficialPack
  sharedCollection?: FollowingSharedCollection
}): FollowingTransferPlan {
  const document = parseDictionaryCollectionExportV2(ports.document)
  const pack =
    ports.officialPack &&
    parseFollowingOfficialPack(ports.officialPack, document.entries.length)
  const shared =
    ports.sharedCollection &&
    parseFollowingSharedCollection(
      ports.sharedCollection,
      document.entries.length
    )
  if (pack && shared) throw new Error('Ambiguous following transfer source')
  if (
    !ports.selectedIndexes.length ||
    new Set(ports.selectedIndexes).size !== ports.selectedIndexes.length ||
    ports.selectedIndexes.some(
      index =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= document.entries.length
    )
  )
    throw new Error('Select valid dictionary document entries')
  const revisions = new Map<string, DictionaryRevision>()
  for (const value of ports.revisions) {
    const parsed = parseDictionaryRevision(value)
    if (
      !parsed.success ||
      parsed.data.review_status !== 'published' ||
      revisions.has(parsed.data.revision_id)
    )
      throw new Error('Invalid published dictionary dependencies')
    revisions.set(parsed.data.revision_id, parsed.data)
  }
  const intents: FollowingTransferPlan['intents'] = []
  const review: FollowingTransferPlan['review'] = []
  for (const index of ports.selectedIndexes) {
    const entry = document.entries[index]
    const hint = entry.shared_reference
    const revision = hint && revisions.get(hint.reference.revision_id)
    if (
      !hint ||
      !revision ||
      revision.entry_id !== hint.reference.entry_id ||
      revision.content_sha256 !== hint.content_sha256
    ) {
      review.push({ index, reason: 'unresolved-reference' })
      continue
    }
    if (canonical(entry.content) !== canonical(revision.content)) {
      review.push({ index, reason: 'content-difference' })
      continue
    }
    intents.push({
      index,
      intent: parseDictionaryImportIntentV2({
        protocol_version: 2,
        operation_id: ports.createId(),
        word_id: ports.createId(),
        collection_id: ports.collectionId,
        source: pack
          ? {
              kind: 'official-pack',
              pack_id: pack.pack_id,
              version: pack.version,
              manifest_sha256: pack.manifest_sha256,
              pack_entry_id: pack.entry_ids[index],
              ...hint,
            }
          : shared
            ? {
                kind: 'shared-collection',
                share_token: shared.share_token,
                word_id: shared.word_ids[index],
                ...hint,
              }
            : { kind: 'published-reference', ...hint },
      }),
    })
  }
  return { document, intents, review }
}
