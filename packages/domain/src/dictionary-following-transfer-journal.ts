import {
  parseDictionaryCollectionExportV2,
  parseDictionaryImportIntentV2,
  type DictionaryCollectionExportV2,
} from './dictionary-following-import'
import { requireFollowingImportOwner } from './dictionary-following-import-journal'
import {
  planDictionaryFollowingTransfer,
  parseFollowingOfficialPack,
  parseFollowingSharedCollection,
  type FollowingSharedCollection,
  type FollowingOfficialPack,
  type FollowingTransferPlan,
} from './dictionary-following-transfer'
import {
  parseDictionaryRevision,
  type DictionaryRevision,
} from './shared-dictionary'

export const FOLLOWING_TRANSFER_LIMIT = 10
export const FOLLOWING_TRANSFER_TEXT_LIMIT = 1_000_000
export const FOLLOWING_TRANSFER_SELECTION_LIMIT = 100
const INVALID = 'Invalid following transfer session'
const CHANGED = 'Following transfer session is immutable'
type TransferDecision = Omit<FollowingTransferPlan, 'document'> & {
  revisions: DictionaryRevision[]
}
export interface FollowingTransferSession {
  user_id: string
  session_id: string
  document: DictionaryCollectionExportV2
  collection_id: string
  selected_indexes: number[]
  plan: TransferDecision | null
  official_pack?: FollowingOfficialPack
  shared_collection?: FollowingSharedCollection
}
export interface FollowingTransferJournal {
  list(userId: string): Promise<FollowingTransferSession[]>
  prepare(
    value: FollowingTransferSession,
    assertOwner: () => void
  ): Promise<FollowingTransferSession>
  decide(
    expected: FollowingTransferSession,
    revisions: readonly DictionaryRevision[],
    createId: () => string,
    assertOwner: () => void
  ): Promise<FollowingTransferSession>
}
const object = (value: unknown, keys: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(INVALID)
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).length !== keys.length ||
    keys.some(key => !Object.hasOwn(row, key))
  )
    throw new Error(INVALID)
  return row
}
const indexes = (value: unknown, count: number) => {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > FOLLOWING_TRANSFER_SELECTION_LIMIT ||
    new Set(value).size !== value.length ||
    value.some(index => !Number.isInteger(index) || index < 0 || index >= count)
  )
    throw new Error(INVALID)
  return (value as number[]).slice().sort((a, b) => a - b)
}
const published = (value: unknown): DictionaryRevision => {
  const parsed = parseDictionaryRevision(value)
  if (!parsed.success || parsed.data.review_status !== 'published')
    throw new Error(INVALID)
  return parsed.data
}
const makeDecision = (
  session: FollowingTransferSession,
  revisions: readonly DictionaryRevision[],
  createId: () => string
): TransferDecision => {
  const ids = new Set(
    session.selected_indexes.flatMap(index => {
      const hint = session.document.entries[index].shared_reference
      return hint ? [hint.reference.revision_id] : []
    })
  )
  if (revisions.some(revision => !ids.has(revision.revision_id)))
    throw new Error(INVALID)
  const plan = planDictionaryFollowingTransfer({
    document: session.document,
    collectionId: session.collection_id,
    selectedIndexes: session.selected_indexes,
    revisions,
    createId,
    officialPack: session.official_pack,
    sharedCollection: session.shared_collection,
  })
  return {
    revisions: revisions.map(published),
    intents: plan.intents,
    review: plan.review,
  }
}
export function parseFollowingTransferSession(
  value: unknown
): FollowingTransferSession {
  const hasPack = Boolean(
    value && typeof value === 'object' && Object.hasOwn(value, 'official_pack')
  )
  const hasShared = Boolean(
    value &&
    typeof value === 'object' &&
    Object.hasOwn(value, 'shared_collection')
  )
  if (hasPack && hasShared) throw new Error(INVALID)
  const row = object(value, [
    'user_id',
    'session_id',
    'document',
    'collection_id',
    'selected_indexes',
    'plan',
    ...(hasPack ? ['official_pack'] : []),
    ...(hasShared ? ['shared_collection'] : []),
  ])
  const document = parseDictionaryCollectionExportV2(row.document)
  const session: FollowingTransferSession = {
    user_id: requireFollowingImportOwner(row.user_id),
    session_id: requireFollowingImportOwner(row.session_id),
    document,
    collection_id: requireFollowingImportOwner(row.collection_id),
    selected_indexes: indexes(row.selected_indexes, document.entries.length),
    plan: null,
    ...(hasShared
      ? {
          shared_collection: parseFollowingSharedCollection(
            row.shared_collection,
            document.entries.length
          ),
        }
      : {}),
    ...(hasPack
      ? {
          official_pack: parseFollowingOfficialPack(
            row.official_pack,
            document.entries.length
          ),
        }
      : {}),
  }
  if (row.plan === null) return session
  const plan = object(row.plan, ['revisions', 'intents', 'review'])
  if (
    !Array.isArray(plan.revisions) ||
    !Array.isArray(plan.intents) ||
    !Array.isArray(plan.review) ||
    plan.revisions.length > FOLLOWING_TRANSFER_SELECTION_LIMIT
  )
    throw new Error(INVALID)
  const intents = plan.intents.map(value => {
    const item = object(value, ['index', 'intent'])
    return {
      index: item.index,
      intent: parseDictionaryImportIntentV2(item.intent),
    }
  })
  const ids = intents.flatMap(item => [
    item.intent.operation_id,
    item.intent.word_id,
  ])
  if (new Set(ids).size !== ids.length || ids.includes(session.session_id))
    throw new Error(INVALID)
  let position = 0
  const decision = makeDecision(session, plan.revisions.map(published), () => {
    const id = ids[position++]
    if (!id) throw new Error(INVALID)
    return id
  })
  if (
    JSON.stringify(decision.intents) !== JSON.stringify(intents) ||
    JSON.stringify(decision.review) !== JSON.stringify(plan.review) ||
    position !== ids.length
  )
    throw new Error(INVALID)
  return { ...session, plan: decision }
}
export function parseFollowingTransferRows(
  value: unknown,
  userId: string
): FollowingTransferSession[] {
  requireFollowingImportOwner(userId)
  if (
    !Array.isArray(value) ||
    value.length > FOLLOWING_TRANSFER_LIMIT ||
    JSON.stringify(value).length > FOLLOWING_TRANSFER_TEXT_LIMIT
  )
    throw new Error('Following transfer storage exceeds its limit')
  const rows = value.map(parseFollowingTransferSession)
  const ids = rows.flatMap(row => [
    row.session_id,
    ...(row.plan?.intents.flatMap(item => [
      item.intent.operation_id,
      item.intent.word_id,
    ]) ?? []),
  ])
  if (
    rows.some(row => row.user_id !== userId) ||
    new Set(ids).size !== ids.length
  )
    throw new Error('Following transfer identity mismatch')
  return rows
}
const draftIdentity = (value: FollowingTransferSession) =>
  JSON.stringify({ ...value, plan: null })
export function prepareFollowingTransferRows(
  rows: FollowingTransferSession[],
  value: FollowingTransferSession
): FollowingTransferSession[] {
  const next = parseFollowingTransferSession(value)
  if (next.plan !== null)
    throw new Error('Expected an unplanned following transfer')
  const old = rows.find(row => row.session_id === next.session_id)
  if (old) {
    if (draftIdentity(old) !== draftIdentity(next)) throw new Error(CHANGED)
    return rows
  }
  return parseFollowingTransferRows([...rows, next], next.user_id)
}
export function decideFollowingTransferRows(
  rows: FollowingTransferSession[],
  expected: FollowingTransferSession,
  revisions: readonly DictionaryRevision[],
  createId: () => string
): FollowingTransferSession[] {
  const input = parseFollowingTransferSession(expected)
  const old = rows.find(row => row.session_id === input.session_id)
  if (!old || JSON.stringify(old) !== JSON.stringify(input))
    throw new Error(CHANGED)
  if (old.plan) return rows
  const next = { ...old, plan: makeDecision(old, revisions, createId) }
  return parseFollowingTransferRows(
    rows.map(row => (row === old ? next : row)),
    old.user_id
  )
}
