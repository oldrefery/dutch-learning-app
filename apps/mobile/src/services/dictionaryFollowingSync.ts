import {
  DICTIONARY_EFFECTIVE_BATCH_LIMIT,
  requireFollowingImportCard,
  followingImportHydrationWordId,
  type FollowingImportHydrationKind,
  type FollowingImportOperation,
  requireDictionaryAnalysisPublication,
  type DictionaryAnalysisClientOperation,
  parseDictionaryChangePageV2,
  parseDictionaryEffectiveBatchV2,
  parseDictionaryFollowingCapability,
  type DictionaryChangePageV2,
  type DictionaryEffectiveBatchV2,
  type DictionaryContentCommand,
} from '@woordenaar/domain'
import { isDictionaryFollowingEnabled } from '@/constants/dictionaryContent'
import { dictionaryFollowingRepository as repository } from '@/db/dictionaryFollowingRepository'
import {
  boundedDictionaryWordIds,
  requireFollowingValue as parsed,
} from '@/db/dictionaryFollowingHydration'
import type { DictionaryReviewedModeDecision } from '@/db/dictionaryModeReconciliationRepository'
import { supabase } from '@/lib/supabase'
import {
  withDictionaryOwner,
  type DictionaryOwnerGuard,
} from './dictionaryImportOwner'

const PAGE_SIZE = 200
const MAX_CHANGE_PAGES = 50
const MAX_HYDRATION_PASSES = 3

const assertEnabled = (owner: DictionaryOwnerGuard): void => {
  owner.assert()
  if (!isDictionaryFollowingEnabled())
    throw new Error('Dictionary following is disabled')
}

const readAvailability = async (
  owner: DictionaryOwnerGuard
): Promise<boolean> => {
  assertEnabled(owner)
  const { data, error } = await supabase.rpc('dictionary_content_capability_v2')
  await owner.check()
  assertEnabled(owner)
  if (error?.code === 'PGRST202' || error?.code === '42883') return false
  if (error) throw error
  const capability = parseDictionaryFollowingCapability(data)
  return capability.success && capability.data.following_enabled
}

const requireAvailability = async (owner: DictionaryOwnerGuard) => {
  if (!(await readAvailability(owner)))
    throw new Error('Dictionary following protocol is unavailable')
}

const uniqueBoundedIds = (ids: readonly string[]): string[] =>
  boundedDictionaryWordIds([...new Set(ids)])

/** Every RPC must return exactly its requested cards and all dependencies. */
const fetchBatches = async (
  wordIds: readonly string[],
  owner: DictionaryOwnerGuard
): Promise<DictionaryEffectiveBatchV2[]> => {
  const batches: DictionaryEffectiveBatchV2[] = []
  for (
    let offset = 0;
    offset < wordIds.length;
    offset += DICTIONARY_EFFECTIVE_BATCH_LIMIT
  ) {
    const chunk = wordIds.slice(
      offset,
      offset + DICTIONARY_EFFECTIVE_BATCH_LIMIT
    )
    assertEnabled(owner)
    const { data, error } = await supabase.rpc(
      'get_dictionary_effective_content_v2',
      {
        p_word_ids: chunk,
      }
    )
    await owner.check()
    assertEnabled(owner)
    if (error) throw error
    const batch = parsed(parseDictionaryEffectiveBatchV2(data))
    const requested = new Set(chunk)
    if (
      batch.cards.length !== requested.size ||
      batch.cards.some(card => !requested.has(card.word_id))
    )
      throw new Error('Incomplete dictionary following batch')
    batches.push(batch)
  }
  return batches
}

/** A newly discovered shared reference may require its already-cached siblings.
 * Refetch the complete group; never combine snapshots from different passes. */
const hydrate = async (
  userId: string,
  ids: readonly string[],
  owner: DictionaryOwnerGuard,
  page?: DictionaryChangePageV2,
  acknowledgedCommands: readonly DictionaryContentCommand[] = [],
  analysisOperation?: DictionaryAnalysisClientOperation,
  importOperation?: FollowingImportOperation,
  importKind: FollowingImportHydrationKind = 'imported',
  modeDecision?: DictionaryReviewedModeDecision
): Promise<number> => {
  let wordIds = uniqueBoundedIds(ids)
  for (let pass = 0; pass < MAX_HYDRATION_PASSES; pass++) {
    assertEnabled(owner)
    const request = await repository.prepareHydration(userId, wordIds, () =>
      assertEnabled(owner)
    )
    if (pass === 0 && !page) await requireAvailability(owner)
    const batches = await fetchBatches(request.wordIds, owner)
    const entryIds = [
      ...new Set(
        batches.flatMap(batch =>
          batch.cards.flatMap(card =>
            card.mode === 'follow' ? [card.reference.entry_id] : []
          )
        )
      ),
    ]
    const related = await repository.getWordIdsByEntryIds(userId, entryIds)
    const expanded = uniqueBoundedIds([...wordIds, ...related])
    assertEnabled(owner)
    if (expanded.length !== wordIds.length) {
      wordIds = expanded
      continue
    }
    if (analysisOperation)
      requireDictionaryAnalysisPublication(
        analysisOperation,
        batches
          .flatMap(batch => batch.cards)
          .find(card => card.word_id === analysisOperation.word_id)
      )
    if (importOperation)
      requireFollowingImportCard(
        importOperation,
        batches
          .flatMap(batch => batch.cards)
          .find(
            card =>
              card.word_id ===
              followingImportHydrationWordId(importOperation, importKind)
          ),
        importKind
      )
    await owner.check()
    if (modeDecision) {
      await repository.commitReviewedMode(modeDecision, request, batches, () =>
        assertEnabled(owner)
      )
      return wordIds.length
    }
    await repository.commitHydration(
      request,
      batches,
      () => assertEnabled(owner),
      page,
      acknowledgedCommands,
      analysisOperation
    )
    return wordIds.length
  }
  throw new Error(
    'Dictionary references changed repeatedly; retry synchronization'
  )
}

const refreshPages = async (
  userId: string,
  owner: DictionaryOwnerGuard
): Promise<number> => {
  let after = await repository.getChangeCursor(userId)
  let refreshedChanges = 0
  for (let count = 0; count < MAX_CHANGE_PAGES; count++) {
    assertEnabled(owner)
    const { data, error } = await supabase.rpc(
      'get_dictionary_content_changes_v2',
      {
        p_after: after,
        p_limit: PAGE_SIZE,
      }
    )
    await owner.check()
    assertEnabled(owner)
    if (error) throw error
    const page = parsed(parseDictionaryChangePageV2(data))
    if (page.after !== after || page.changes.length > PAGE_SIZE)
      throw new Error('Invalid dictionary following page boundary')
    const wordIds = await repository.getWordIdsByEntryIds(userId, [
      ...new Set(page.changes.map(change => change.entry_id)),
    ])
    await hydrate(userId, wordIds, owner, page)
    refreshedChanges += page.changes.length
    after = page.next_cursor
    if (!page.has_more) return refreshedChanges
  }
  throw new Error(
    'Dictionary change refresh limit reached; retry synchronization'
  )
}

/** Build-time opt-in v2 reads. Verified legacy receipts are acknowledged together
 * with complete hydration; unknown intents remain preserved for reconciliation. */
export const dictionaryFollowingSync = {
  requireAvailability,
  async pullForMode(
    decision: DictionaryReviewedModeDecision,
    owner: DictionaryOwnerGuard
  ): Promise<number> {
    return hydrate(
      decision.userId,
      [decision.wordId],
      owner,
      undefined,
      [],
      undefined,
      undefined,
      'imported',
      decision
    )
  },
  async pullForImport(
    operation: FollowingImportOperation,
    owner: DictionaryOwnerGuard,
    kind: FollowingImportHydrationKind = 'imported'
  ): Promise<number> {
    return hydrate(
      operation.user_id,
      [followingImportHydrationWordId(operation, kind)],
      owner,
      undefined,
      [],
      undefined,
      operation,
      kind
    )
  },

  async pullForAnalysis(
    operation: DictionaryAnalysisClientOperation,
    owner: DictionaryOwnerGuard
  ): Promise<number> {
    // Receipt/debt survives disabled flags and unavailable publication hydration.
    await repository.prepareHydration(
      operation.user_id,
      [operation.word_id],
      owner.assert
    )
    return hydrate(
      operation.user_id,
      [operation.word_id],
      owner,
      undefined,
      [],
      operation
    )
  },

  async isAvailable(userId: string): Promise<boolean> {
    if (!isDictionaryFollowingEnabled()) return false
    return withDictionaryOwner(userId, readAvailability)
  },

  async pull(
    userId: string,
    wordIds: readonly string[],
    acknowledgedCommands: readonly DictionaryContentCommand[] = []
  ): Promise<number> {
    if (!isDictionaryFollowingEnabled()) return 0
    const ids = uniqueBoundedIds(wordIds)
    if (ids.length === 0) return 0
    return withDictionaryOwner(userId, async owner => {
      return hydrate(userId, ids, owner, undefined, acknowledgedCommands)
    })
  },

  async pullRequired(
    userId: string,
    candidateWordIds: readonly string[] = []
  ): Promise<number> {
    if (!isDictionaryFollowingEnabled()) return 0
    const candidates = uniqueBoundedIds(candidateWordIds)
    return withDictionaryOwner(userId, async owner => {
      const [missing, legacyDebt] = await Promise.all([
        repository.getMissingCardWordIds(userId),
        repository.getLegacyRefreshWordIds(userId),
      ])
      const ids = uniqueBoundedIds([...candidates, ...missing, ...legacyDebt])
      if (ids.length === 0) return 0
      return hydrate(userId, ids, owner)
    })
  },

  async refreshChanges(userId: string): Promise<number> {
    if (!isDictionaryFollowingEnabled()) return 0
    return withDictionaryOwner(userId, async owner => {
      await requireAvailability(owner)
      return refreshPages(userId, owner)
    })
  },
}
