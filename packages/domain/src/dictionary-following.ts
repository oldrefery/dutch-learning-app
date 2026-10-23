import {
  parseDictionaryReference,
  parseDictionaryRevision,
  type DictionaryContent,
  type DictionaryContentField,
  type DictionaryReference,
  type DictionaryRevision,
  type DictionaryValidationIssue,
  type DictionaryValidationResult,
} from './shared-dictionary'
import {
  parseDictionaryReadContent,
  type DictionaryReadContent,
} from './dictionary-read-content'

export const DICTIONARY_FOLLOWING_PROTOCOL_VERSION = 2 as const
export const DICTIONARY_EFFECTIVE_BATCH_LIMIT = 1000
export const DICTIONARY_REVIEW_SNAPSHOT_LIMIT = 10_000
export type DictionaryContentMode = 'legacy' | 'follow'
export type DictionarySequence = string

export interface DictionaryFollowingCapability {
  dictionary_content_protocol: 2
  read_protocol_versions: number[]
  command_protocol_versions: number[]
  following_enabled: boolean
  shared_analysis_enabled: boolean
}

export interface DictionaryCardCefr {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null
  status: 'unknown' | 'estimated' | 'reviewed'
  confidence: number | null
}

interface CardBase {
  word_id: string
  content_version: DictionarySequence
  cefr: DictionaryCardCefr
}

export interface FollowingDictionaryCard extends CardBase {
  mode: 'follow'
  reference: DictionaryReference
  adopted_revision_id: string
  head_sequence: DictionarySequence
  legacy_content: null
  removed_fields: []
}

export interface LegacyDictionaryCard extends CardBase {
  mode: 'legacy'
  reference: DictionaryReference | null
  adopted_revision_id: string | null
  head_sequence: null
  legacy_content: DictionaryReadContent
  removed_fields: DictionaryContentField[]
}

export type DictionaryEffectiveCardV2 =
  FollowingDictionaryCard | LegacyDictionaryCard

export interface DictionaryEffectiveBatchV2 {
  protocol_version: 2
  watermark: DictionarySequence
  cards: DictionaryEffectiveCardV2[]
  revisions: DictionaryRevision[]
}

export type DictionaryHeadChangeV2 = {
  cursor: DictionarySequence
  entry_id: string
} & (
  | { kind: 'revision-head'; revision_id: string; assessment_id: null }
  | { kind: 'cefr-head'; revision_id: null; assessment_id: string }
)

export interface DictionaryChangePageV2 {
  protocol_version: 2
  after: DictionarySequence
  next_cursor: DictionarySequence
  latest_cursor: DictionarySequence
  has_more: boolean
  changes: DictionaryHeadChangeV2[]
}

const MAX_SEQUENCE = '9223372036854775807'
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = (path: string, message: string): never => {
  throw new ContractError(path, message)
}

class ContractError extends Error {
  constructor(
    readonly path: string,
    message: string
  ) {
    super(message)
  }
}

const record = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return fail(path, 'must be an object')
  return value as Record<string, unknown>
}

const exact = (
  value: Record<string, unknown>,
  fields: string[],
  path: string
): void => {
  if (
    Object.keys(value).length !== fields.length ||
    fields.some(key => !Object.hasOwn(value, key))
  )
    fail(path, 'must contain exactly the supported fields')
}

const array = (value: unknown, path: string, limit: number): unknown[] => {
  if (!Array.isArray(value) || value.length > limit)
    return fail(path, `must be an array of at most ${limit} items`)
  return value
}

const uuid = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    return fail(path, 'must be a UUID')
  return value.toLowerCase()
}

const sequence = (value: unknown, path: string): DictionarySequence => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(value))
    return fail(path, 'must be a canonical non-negative decimal string')
  if (value.length === MAX_SEQUENCE.length && value > MAX_SEQUENCE)
    return fail(path, 'exceeds PostgreSQL BIGINT')
  return value
}

const parsed = <T>(result: DictionaryValidationResult<T>, path: string): T => {
  if (!result.success)
    return fail(path, result.issues[0]?.message ?? 'is invalid')
  return result.data
}

const validate = <T>(read: () => T): DictionaryValidationResult<T> => {
  try {
    return { success: true, data: read() }
  } catch (error) {
    if (!(error instanceof ContractError)) throw error
    const issues: DictionaryValidationIssue[] = [
      { path: error.path, message: error.message },
    ]
    return { success: false, issues }
  }
}

export const parseDictionarySequence = (
  value: unknown
): DictionaryValidationResult<DictionarySequence> =>
  validate(() => sequence(value, 'sequence'))

export const compareDictionarySequences = (
  left: string,
  right: string
): -1 | 0 | 1 => {
  const a = sequence(left, 'left')
  const b = sequence(right, 'right')
  // Canonical non-negative decimals order by length, then by their ASCII digits.
  // Keep the full BIGINT range without allocating BigInts for every cached card.
  if (a.length !== b.length) return a.length < b.length ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

const readVersions = (value: unknown, path: string): number[] => {
  const versions = array(value, path, 2)
  if (
    versions.some(version => version !== 1 && version !== 2) ||
    new Set(versions).size !== versions.length
  )
    return fail(path, 'must contain unique supported protocol versions')
  return versions as number[]
}

export const parseDictionaryFollowingCapability = (
  value: unknown
): DictionaryValidationResult<DictionaryFollowingCapability> =>
  validate(() => {
    const row = record(value, 'capability')
    exact(
      row,
      [
        'dictionary_content_protocol',
        'read_protocol_versions',
        'command_protocol_versions',
        'following_enabled',
        'shared_analysis_enabled',
      ],
      'capability'
    )
    if (row.dictionary_content_protocol !== 2)
      fail('capability', 'requires protocol 2')
    const reads = readVersions(
      row.read_protocol_versions,
      'capability.read_protocol_versions'
    )
    const commands = readVersions(
      row.command_protocol_versions,
      'capability.command_protocol_versions'
    )
    if (
      typeof row.following_enabled !== 'boolean' ||
      typeof row.shared_analysis_enabled !== 'boolean'
    )
      fail('capability', 'requires explicit boolean behavior flags')
    if (
      (row.following_enabled && !reads.includes(2)) ||
      (row.shared_analysis_enabled && !commands.includes(2))
    )
      fail('capability', 'enabled behavior requires its supported protocol')
    return {
      dictionary_content_protocol: 2,
      read_protocol_versions: reads,
      command_protocol_versions: commands,
      following_enabled: row.following_enabled as boolean,
      shared_analysis_enabled: row.shared_analysis_enabled as boolean,
    }
  })

const readCefr = (value: unknown): DictionaryCardCefr => {
  const row = record(value, 'card.cefr')
  exact(row, ['level', 'status', 'confidence'], 'card.cefr')
  const levels: unknown[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  if (
    (row.status !== 'unknown' &&
      row.status !== 'estimated' &&
      row.status !== 'reviewed') ||
    (row.status === 'unknown'
      ? row.level !== null
      : !levels.includes(row.level))
  )
    fail('card.cefr', 'level must match assessment status')
  if (
    row.confidence !== null &&
    (typeof row.confidence !== 'number' ||
      !Number.isFinite(row.confidence) ||
      row.confidence < 0 ||
      row.confidence > 1)
  )
    fail('card.cefr.confidence', 'must be null or within 0..1')
  return {
    level: row.level as DictionaryCardCefr['level'],
    status: row.status as DictionaryCardCefr['status'],
    confidence: row.confidence as number | null,
  }
}

const readCard = (
  value: unknown,
  watermark: string
): DictionaryEffectiveCardV2 => {
  const row = record(value, 'card')
  exact(
    row,
    [
      'word_id',
      'mode',
      'content_version',
      'reference',
      'adopted_revision_id',
      'head_sequence',
      'legacy_content',
      'removed_fields',
      'cefr',
    ],
    'card'
  )
  const base: CardBase = {
    word_id: uuid(row.word_id, 'card.word_id'),
    content_version: sequence(row.content_version, 'card.content_version'),
    cefr: readCefr(row.cefr),
  }
  const reference =
    row.reference === null
      ? null
      : parsed(parseDictionaryReference(row.reference), 'card.reference')
  const adopted =
    row.adopted_revision_id === null
      ? null
      : uuid(row.adopted_revision_id, 'card.adopted_revision_id')
  const removed = array(row.removed_fields, 'card.removed_fields', 23)
  if (row.mode === 'follow') {
    const head = sequence(row.head_sequence, 'card.head_sequence')
    if (
      reference === null ||
      adopted === null ||
      row.legacy_content !== null ||
      removed.length !== 0 ||
      head === '0' ||
      compareDictionarySequences(head, watermark) > 0
    )
      return fail('card', 'invalid following reference or dependency boundary')
    return {
      ...base,
      mode: 'follow',
      reference,
      adopted_revision_id: adopted,
      head_sequence: head,
      legacy_content: null,
      removed_fields: [],
    }
  }
  if (row.mode !== 'legacy' || row.head_sequence !== null)
    return fail('card.mode', 'requires legacy or follow')
  if (
    (reference === null) !== (adopted === null) ||
    (reference !== null && reference.revision_id !== adopted)
  )
    fail('card.reference', 'legacy reference must match its adopted revision')
  const content = parsed(
    parseDictionaryReadContent(row.legacy_content),
    'card.legacy_content'
  )
  if (
    new Set(removed).size !== removed.length ||
    removed.some(
      field =>
        typeof field !== 'string' ||
        !Object.hasOwn(content, field) ||
        content[field as keyof DictionaryReadContent] !== null
    )
  )
    fail('card.removed_fields', 'must contain unique content fields')
  return {
    ...base,
    mode: 'legacy',
    reference,
    adopted_revision_id: adopted,
    head_sequence: null,
    legacy_content: content,
    removed_fields: removed as DictionaryContentField[],
  }
}

export const parseDictionaryEffectiveBatchV2 = (
  value: unknown
): DictionaryValidationResult<DictionaryEffectiveBatchV2> =>
  validate(() => {
    const row = record(value, 'batch')
    exact(row, ['protocol_version', 'watermark', 'cards', 'revisions'], 'batch')
    if (row.protocol_version !== 2)
      fail('batch.protocol_version', 'requires protocol 2')
    const watermark = sequence(row.watermark, 'batch.watermark')
    const revisions = array(
      row.revisions,
      'batch.revisions',
      DICTIONARY_REVIEW_SNAPSHOT_LIMIT
    ).map(item => parsed(parseDictionaryRevision(item), 'batch.revisions'))
    const dependencies = new Map(
      revisions.map(revision => [revision.revision_id, revision])
    )
    if (dependencies.size !== revisions.length)
      fail('batch.revisions', 'duplicate revision dependency')
    const cards = array(
      row.cards,
      'batch.cards',
      DICTIONARY_REVIEW_SNAPSHOT_LIMIT
    ).map(item => readCard(item, watermark))
    if (new Set(cards.map(card => card.word_id)).size !== cards.length)
      fail('batch.cards', 'duplicate personal reference')
    const used = new Set<string>()
    for (const card of cards) {
      if (card.reference === null) continue
      const dependency = dependencies.get(card.reference.revision_id)
      if (
        !dependency ||
        dependency.entry_id !== card.reference.entry_id ||
        (card.mode === 'follow'
          ? dependency.review_status !== 'published'
          : dependency.review_status === 'draft')
      )
        fail('batch.revisions', 'missing, mismatched or unpublished dependency')
      used.add(card.reference.revision_id)
    }
    if (used.size !== dependencies.size)
      fail('batch.revisions', 'unrequested dependency')
    return { protocol_version: 2, watermark, cards, revisions }
  })

const readChange = (value: unknown): DictionaryHeadChangeV2 => {
  const row = record(value, 'change')
  exact(
    row,
    ['cursor', 'kind', 'entry_id', 'revision_id', 'assessment_id'],
    'change'
  )
  const base = {
    cursor: sequence(row.cursor, 'change.cursor'),
    entry_id: uuid(row.entry_id, 'change.entry_id'),
  }
  if (row.kind === 'revision-head' && row.assessment_id === null)
    return {
      ...base,
      kind: 'revision-head',
      revision_id: uuid(row.revision_id, 'change.revision_id'),
      assessment_id: null,
    }
  if (row.kind === 'cefr-head' && row.revision_id === null)
    return {
      ...base,
      kind: 'cefr-head',
      revision_id: null,
      assessment_id: uuid(row.assessment_id, 'change.assessment_id'),
    }
  return fail('change', 'requires exactly one matching revision or assessment')
}

export const parseDictionaryChangePageV2 = (
  value: unknown,
  requestedAfter?: string
): DictionaryValidationResult<DictionaryChangePageV2> =>
  validate(() => {
    const row = record(value, 'page')
    exact(
      row,
      [
        'protocol_version',
        'after',
        'next_cursor',
        'latest_cursor',
        'has_more',
        'changes',
      ],
      'page'
    )
    if (row.protocol_version !== 2 || typeof row.has_more !== 'boolean')
      fail('page', 'requires protocol 2 and has_more')
    const after = sequence(row.after, 'page.after')
    const next = sequence(row.next_cursor, 'page.next_cursor')
    const latest = sequence(row.latest_cursor, 'page.latest_cursor')
    if (
      requestedAfter !== undefined &&
      after !== sequence(requestedAfter, 'requestedAfter')
    )
      fail('page.after', 'does not match requested cursor')
    if (
      compareDictionarySequences(after, next) > 0 ||
      compareDictionarySequences(next, latest) > 0
    )
      fail('page', 'invalid cursor progression')
    const changes = array(row.changes, 'page.changes', 500).map(readChange)
    let previous = after
    for (const change of changes) {
      if (
        compareDictionarySequences(previous, change.cursor) >= 0 ||
        compareDictionarySequences(change.cursor, next) > 0
      )
        fail('page.changes', 'invalid change ordering')
      previous = change.cursor
    }
    if (
      (changes.length > 0 && previous !== next) ||
      (row.has_more && (changes.length === 0 || next === latest))
    )
      fail('page.next_cursor', 'must match the bounded change page')
    if (changes.length === 0 && next !== latest)
      fail(
        'page.next_cursor',
        'empty terminal page must acknowledge the snapshot watermark'
      )
    return {
      protocol_version: 2,
      after,
      next_cursor: next,
      latest_cursor: latest,
      has_more: row.has_more as boolean,
      changes,
    }
  })

export const resolveFollowingDictionaryContent = (
  batch: DictionaryEffectiveBatchV2,
  wordId: string
): DictionaryContent | DictionaryReadContent | undefined => {
  const card = batch.cards.find(item => item.word_id === wordId)
  if (!card) return undefined
  if (card.mode === 'legacy') return card.legacy_content
  return batch.revisions.find(
    revision =>
      revision.revision_id === card.reference.revision_id &&
      revision.entry_id === card.reference.entry_id &&
      revision.review_status === 'published'
  )?.content
}
