import { parseDictionaryEffectiveBatchV2 } from '@woordenaar/domain'
import { dictionaryFollowingRepository } from '@/db/dictionaryFollowingRepository'
import { requireFollowingValue } from '@/db/dictionaryFollowingHydration'
import { projectDictionaryReadWord } from '@/db/dictionaryReadProjection'
import type { DictionaryBootstrapSnapshot } from './dictionaryFollowingSync'
import { supabase } from '@/lib/supabase'
import { wordRepository } from '@/db/wordRepository'
import {
  comparePersonalTimestamps,
  parsePersonalMetadata,
  personalStorageWord,
  requirePersonalBootstrap,
  type PersonalMetadataRow,
} from '@/db/dictionaryPersonalMetadata'
import { setSyncCursor, type SyncCursor } from '@/utils/network'
import {
  withDictionaryOwner,
  type DictionaryOwnerGuard,
} from './dictionaryImportOwner'

const PAGE_SIZE = 500
const boundary = (row: PersonalMetadataRow): SyncCursor => ({
  updatedAt: row.updated_at,
  id: row.word_id,
})
const compare = (left: SyncCursor, right: SyncCursor) =>
  comparePersonalTimestamps(left.updatedAt, right.updatedAt) ||
  left.id.localeCompare(right.id)

const requirePageRow = (
  row: PersonalMetadataRow,
  seen: ReadonlySet<string>,
  requested: ReadonlySet<string> | undefined,
  after: SyncCursor | undefined,
  cursor: SyncCursor | null
): SyncCursor => {
  const next = boundary(row)
  if (
    seen.has(row.word_id) ||
    (requested && !requested.has(row.word_id)) ||
    (after && compare(next, after) <= 0) ||
    (cursor && comparePersonalTimestamps(next.updatedAt, cursor.updatedAt) < 0)
  )
    throw new Error('Invalid personal metadata boundary')
  return next
}

async function read(
  userId: string,
  cursor: SyncCursor | null,
  ids: readonly string[] | undefined,
  owner: DictionaryOwnerGuard
): Promise<PersonalMetadataRow[]> {
  const rows: PersonalMetadataRow[] = []
  const seen = new Set<string>()
  const requested = ids && new Set(ids)
  let after: SyncCursor | undefined
  while (true) {
    owner.assert()
    const { data, error } = await supabase
      .rpc('d14_read_personal_metadata_v1', {
        p_word_ids: ids ? [...ids] : null,
        p_since_updated_at: cursor?.updatedAt ?? null,
        p_after_updated_at: after?.updatedAt ?? null,
        p_after_word_id: after?.id ?? null,
        p_limit: PAGE_SIZE,
      })
      .order('updated_at')
      .order('word_id')
    owner.assert()
    if (error) throw error
    if (!Array.isArray(data) || data.length > PAGE_SIZE)
      throw new Error('Invalid personal metadata page')
    for (const value of data) {
      const row = parsePersonalMetadata(value, userId)
      const next = requirePageRow(row, seen, requested, after, cursor)
      after = next
      seen.add(row.word_id)
      if (!cursor || compare(next, cursor) > 0) rows.push(row)
    }
    if (data.length < PAGE_SIZE) return rows
  }
}

function applyBootstrapBatch(
  data: { rows?: unknown; snapshot?: unknown } | null,
  chunk: readonly string[],
  byId: ReadonlyMap<string, PersonalMetadataRow>,
  userId: string
) {
  const requested = new Set(chunk)
  if (!data || !Array.isArray(data.rows) || data.rows.length !== chunk.length)
    throw new Error('Complete personal bootstrap is unavailable')

  const batch = requireFollowingValue(
    parseDictionaryEffectiveBatchV2(data.snapshot)
  )
  const cards = new Map(batch.cards.map(card => [card.word_id, card]))
  const revisions = new Map(
    batch.revisions.map(revision => [revision.revision_id, revision])
  )
  if (cards.size !== chunk.length)
    throw new Error('Incomplete following bootstrap snapshot')

  for (const value of data.rows) {
    const current = parsePersonalMetadata(value, userId)
    const row = byId.get(current.word_id)
    if (!row || !requested.delete(current.word_id))
      throw new Error('Unexpected personal bootstrap identity')
    const card = cards.get(row.word_id)
    const revision =
      card?.mode === 'follow' && revisions.get(card.reference.revision_id)
    if (
      !revision ||
      !card ||
      card.mode !== 'follow' ||
      card.reference.entry_id !== row.dictionary_entry_id ||
      card.adopted_revision_id !== row.dictionary_revision_id ||
      card.content_version !== row.content_version ||
      current.content_version !== row.content_version
    )
      throw new Error('Personal bootstrap changed during read')

    const word = projectDictionaryReadWord(
      personalStorageWord(current),
      revision.content
    )
    row.bootstrapWord = requirePersonalBootstrap(
      {
        ...word,
        dutch_lemma: current.dutch_lemma,
        part_of_speech: current.part_of_speech,
        article: current.article,
      },
      row
    )
  }
  return batch
}

async function bootstrapNewRows(
  userId: string,
  rows: PersonalMetadataRow[],
  owner: DictionaryOwnerGuard,
  capture: boolean
): Promise<DictionaryBootstrapSnapshot> {
  const ids = await wordRepository.getPersonalBootstrapWordIds(userId, rows)
  const versions = capture
    ? await dictionaryFollowingRepository.readBootstrapVersions(userId, ids)
    : new Map<string, number>()
  const byId = new Map(rows.map(row => [row.word_id, row]))
  const batches: DictionaryBootstrapSnapshot['batches'] = []
  for (let offset = 0; offset < ids.length; offset += 400) {
    const chunk = ids.slice(offset, offset + 400)
    owner.assert()
    const { data, error } = await supabase.rpc(
      'd14_read_following_bootstrap_v1',
      {
        p_word_ids: chunk,
      }
    )
    await owner.check()
    owner.assert()
    if (error) throw error
    batches.push(applyBootstrapBatch(data, chunk, byId, userId))
  }
  return { batches, versions }
}

export function pullPersonalMetadata(
  userId: string,
  cursor: SyncCursor | null,
  ids?: readonly string[],
  importOwner?: DictionaryOwnerGuard,
  entry?: string,
  onBootstrap?: (snapshot: DictionaryBootstrapSnapshot) => void
): Promise<PersonalMetadataRow[]> {
  const apply = async (owner: DictionaryOwnerGuard) => {
    const rows = await read(userId, cursor, ids, owner)
    const recovery: PersonalMetadataRow[] = []
    if (!ids) {
      const received = new Set(rows.map(row => row.word_id))
      const missing = (
        await wordRepository.getSparsePersonalWordIds(userId)
      ).filter(id => !received.has(id))
      for (let offset = 0; offset < missing.length; offset += PAGE_SIZE) {
        const chunk = missing.slice(offset, offset + PAGE_SIZE)
        const exact = await read(userId, null, chunk, owner)
        if (exact.length !== chunk.length)
          throw new Error('Personal bootstrap recovery is incomplete')
        recovery.push(...exact)
      }
    }
    const applying = [...rows, ...recovery]
    await owner.check()
    if (
      importOwner &&
      (rows.length !== 1 ||
        rows[0].deleted_at ||
        (entry &&
          (rows[0].dictionary_content_mode !== 'follow' ||
            rows[0].dictionary_entry_id !== entry)))
    )
      throw new Error(
        'Imported personal learning state or reference is unavailable'
      )
    if (applying.length === 0) return rows
    const bootstrap = await bootstrapNewRows(
      userId,
      applying,
      owner,
      Boolean(onBootstrap)
    )
    const versions = await wordRepository.savePersonalMetadata(
      userId,
      applying,
      owner.assert,
      Boolean(importOwner),
      bootstrap.versions
    )
    owner.assert()
    if (!ids && rows.length)
      await setSyncCursor(userId, 'words', boundary(rows[rows.length - 1]))
    if (bootstrap.batches.length && versions.size)
      onBootstrap?.({ batches: bootstrap.batches, versions })
    return rows
  }
  return importOwner ? apply(importOwner) : withDictionaryOwner(userId, apply)
}
