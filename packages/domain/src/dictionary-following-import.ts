import {
  parseDictionaryContent,
  parseDictionaryReference,
  parseDictionaryRevision,
  type DictionaryContent,
  type DictionaryReference,
  type DictionaryRevision,
} from './shared-dictionary'
import { parseDictionarySequence } from './dictionary-following'

export interface PublishedDictionaryReference {
  reference: DictionaryReference
  content_sha256: string
}
export type FollowingDictionaryImportSource = PublishedDictionaryReference &
  (
    | { kind: 'published-reference' }
    | {
        kind: 'official-pack'
        pack_id: string
        version: string
        pack_entry_id: string
        manifest_sha256: string
      }
    | { kind: 'shared-collection'; share_token: string; word_id: string }
  )
export interface DictionaryImportIntentV2 {
  protocol_version: 2
  operation_id: string
  word_id: string
  collection_id: string
  source: FollowingDictionaryImportSource
}
interface ImportReceiptIdentity {
  protocol_version: 2
  operation_id: string
  word_id: string
  idempotent: boolean
}
export type DictionaryImportReceiptV2 = ImportReceiptIdentity &
  (
    | {
        outcome: 'inserted'
        existing_word_id: null
        reference: DictionaryReference
        applied_reference: DictionaryReference
        applied_head_sequence: string
      }
    | {
        outcome: 'identity-conflict'
        existing_word_id: string
        reference: null
        applied_reference: null
        applied_head_sequence: null
      }
  )
export interface DictionaryTransferEntryV2 {
  content: DictionaryContent
  shared_reference: PublishedDictionaryReference | null
}
export interface DictionaryCollectionExportV2 {
  schema_version: 2
  collection: { name: string }
  entries: DictionaryTransferEntryV2[]
}
export interface SharedDictionaryCollectionV2 {
  schema_version: 2
  collection: { collection_id: string; name: string }
  words: (DictionaryTransferEntryV2 & { word_id: string })[]
}
export type DictionaryCacheResolutionV2 =
  | {
      cache_id: string
      status: 'resolved'
      reference: DictionaryReference
      head_sequence: string
    }
  | {
      cache_id: string
      status:
        'missing' | 'unmapped' | 'expired' | 'unavailable' | 'mapping-mismatch'
      reference: null
      head_sequence: null
    }
export interface DictionaryCacheBatchV2 {
  protocol_version: 2
  resolutions: DictionaryCacheResolutionV2[]
  revisions: DictionaryRevision[]
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const invalid = (): never => {
  throw new Error('Invalid following dictionary contract')
}
const object = (value: unknown, fields: string[]): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  const result = value as Record<string, unknown>
  if (
    Object.keys(result).length !== fields.length ||
    fields.some(k => !Object.hasOwn(result, k))
  )
    return invalid()
  return result
}
const id = (value: unknown): string =>
  typeof value === 'string' && UUID.test(value)
    ? value.toLowerCase()
    : invalid()
const text = (value: unknown, limit = 200): string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= limit
    ? value
    : invalid()
const hash = (value: unknown): string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : invalid()
const reference = (value: unknown): DictionaryReference => {
  const result = parseDictionaryReference(value)
  return result.success ? result.data : invalid()
}
const published = (value: unknown): PublishedDictionaryReference => {
  const r = object(value, ['reference', 'content_sha256'])
  return {
    reference: reference(r.reference),
    content_sha256: hash(r.content_sha256),
  }
}
const sequence = (value: unknown): string => {
  const result = parseDictionarySequence(value)
  return result.success ? result.data : invalid()
}
export function parseDictionaryImportIntentV2(
  value: unknown
): DictionaryImportIntentV2 {
  const r = object(value, [
    'protocol_version',
    'operation_id',
    'word_id',
    'collection_id',
    'source',
  ])
  if (r.protocol_version !== 2) return invalid()
  const kind =
    r.source !== null &&
    typeof r.source === 'object' &&
    !Array.isArray(r.source)
      ? (r.source as Record<string, unknown>).kind
      : null
  const extra =
    kind === 'published-reference'
      ? []
      : kind === 'official-pack'
        ? ['pack_id', 'version', 'pack_entry_id', 'manifest_sha256']
        : kind === 'shared-collection'
          ? ['share_token', 'word_id']
          : invalid()
  const s = object(r.source, ['kind', 'reference', 'content_sha256', ...extra])
  const base = {
    reference: reference(s.reference),
    content_sha256: hash(s.content_sha256),
  }
  const source: FollowingDictionaryImportSource =
    kind === 'published-reference'
      ? { ...base, kind }
      : kind === 'official-pack'
        ? {
            ...base,
            kind,
            pack_id: text(s.pack_id),
            version: text(s.version),
            pack_entry_id: text(s.pack_entry_id),
            manifest_sha256: hash(s.manifest_sha256),
          }
        : {
            ...base,
            kind: 'shared-collection',
            share_token: id(s.share_token),
            word_id: id(s.word_id),
          }
  return {
    protocol_version: 2,
    operation_id: id(r.operation_id),
    word_id: id(r.word_id),
    collection_id: id(r.collection_id),
    source,
  }
}
export function parseDictionaryImportReceiptV2(
  value: unknown,
  intent: DictionaryImportIntentV2
): DictionaryImportReceiptV2 {
  const r = object(value, [
    'protocol_version',
    'operation_id',
    'word_id',
    'idempotent',
    'outcome',
    'existing_word_id',
    'reference',
    'applied_reference',
    'applied_head_sequence',
  ])
  if (
    r.protocol_version !== 2 ||
    id(r.operation_id) !== intent.operation_id ||
    id(r.word_id) !== intent.word_id ||
    typeof r.idempotent !== 'boolean'
  )
    return invalid()
  const base: ImportReceiptIdentity = {
    protocol_version: 2,
    operation_id: id(r.operation_id),
    word_id: id(r.word_id),
    idempotent: r.idempotent,
  }
  if (r.outcome === 'inserted' && r.existing_word_id === null) {
    const adopted = reference(r.reference),
      applied = reference(r.applied_reference)
    if (
      adopted.entry_id !== intent.source.reference.entry_id ||
      adopted.revision_id !== intent.source.reference.revision_id ||
      applied.entry_id !== adopted.entry_id
    )
      return invalid()
    return {
      ...base,
      outcome: 'inserted',
      existing_word_id: null,
      reference: adopted,
      applied_reference: applied,
      applied_head_sequence: sequence(r.applied_head_sequence),
    }
  }
  if (
    r.outcome === 'identity-conflict' &&
    id(r.existing_word_id) !== intent.word_id &&
    r.reference === null &&
    r.applied_reference === null &&
    r.applied_head_sequence === null
  )
    return {
      ...base,
      outcome: 'identity-conflict',
      existing_word_id: id(r.existing_word_id),
      reference: null,
      applied_reference: null,
      applied_head_sequence: null,
    }
  return invalid()
}
const entry = (r: Record<string, unknown>): DictionaryTransferEntryV2 => {
  const result = parseDictionaryContent(r.content)
  if (!result.success) return invalid()
  return {
    content: result.data,
    shared_reference:
      r.shared_reference === null ? null : published(r.shared_reference),
  }
}
export function parseDictionaryCollectionExportV2(
  value: unknown
): DictionaryCollectionExportV2 {
  const r = object(value, ['schema_version', 'collection', 'entries']),
    c = object(r.collection, ['name'])
  if (
    r.schema_version !== 2 ||
    !Array.isArray(r.entries) ||
    r.entries.length > 10000
  )
    return invalid()
  return {
    schema_version: 2,
    collection: { name: text(c.name, 500) },
    entries: r.entries.map(e =>
      entry(object(e, ['content', 'shared_reference']))
    ),
  }
}
export function parseSharedDictionaryCollectionV2(
  value: unknown
): SharedDictionaryCollectionV2 {
  const r = object(value, ['schema_version', 'collection', 'words']),
    c = object(r.collection, ['collection_id', 'name'])
  if (
    r.schema_version !== 2 ||
    !Array.isArray(r.words) ||
    r.words.length > 10000
  )
    return invalid()
  const seen = new Set<string>()
  return {
    schema_version: 2,
    collection: { collection_id: id(c.collection_id), name: text(c.name, 500) },
    words: r.words.map(w => {
      const v = object(w, ['word_id', 'content', 'shared_reference']),
        key = id(v.word_id)
      if (seen.has(key)) return invalid()
      seen.add(key)
      return { ...entry(v), word_id: key }
    }),
  }
}
export function parseDictionaryCacheBatchV2(
  value: unknown
): DictionaryCacheBatchV2 {
  const r = object(value, ['protocol_version', 'resolutions', 'revisions'])
  if (
    r.protocol_version !== 2 ||
    !Array.isArray(r.resolutions) ||
    r.resolutions.length > 500 ||
    !Array.isArray(r.revisions) ||
    r.revisions.length > 500
  )
    return invalid()
  const revisions = new Map<string, DictionaryRevision>()
  for (const item of r.revisions) {
    const parsed = parseDictionaryRevision(item)
    if (
      !parsed.success ||
      parsed.data.review_status !== 'published' ||
      revisions.has(parsed.data.revision_id)
    )
      return invalid()
    revisions.set(parsed.data.revision_id, parsed.data)
  }
  const seen = new Set<string>(),
    used = new Set<string>()
  const resolutions = r.resolutions.map((item): DictionaryCacheResolutionV2 => {
    const v = object(item, [
        'cache_id',
        'status',
        'reference',
        'head_sequence',
      ]),
      cache = id(v.cache_id)
    if (seen.has(cache)) return invalid()
    seen.add(cache)
    if (v.status === 'resolved') {
      const ref = reference(v.reference),
        rev = revisions.get(ref.revision_id)
      if (!rev || rev.entry_id !== ref.entry_id) return invalid()
      used.add(ref.revision_id)
      return {
        cache_id: cache,
        status: 'resolved',
        reference: ref,
        head_sequence: sequence(v.head_sequence),
      }
    }
    if (
      ![
        'missing',
        'unmapped',
        'expired',
        'unavailable',
        'mapping-mismatch',
      ].some(s => s === v.status) ||
      v.reference !== null ||
      v.head_sequence !== null
    )
      return invalid()
    return {
      cache_id: cache,
      status: v.status as
        'missing' | 'unmapped' | 'expired' | 'unavailable' | 'mapping-mismatch',
      reference: null,
      head_sequence: null,
    }
  })
  if (used.size !== revisions.size) return invalid()
  return {
    protocol_version: 2,
    resolutions,
    revisions: [...revisions.values()],
  }
}
