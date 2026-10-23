import {
  parseDictionaryAnalysisClientOperation,
  requireSameAnalysisOperation,
  type DictionaryAnalysisClientOperation,
  compareDictionarySequences,
  parseDictionaryEffectiveBatchV2,
  parseDictionarySequence,
  type DictionaryChangePageV2,
  type DictionaryEffectiveBatchV2,
  type DictionaryRevision,
  type DictionaryContentCommand,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'
import { acknowledgeFollowingCommands } from './dictionaryFollowingAcknowledgement'
import {
  boundedDictionaryWordIds as boundedIds,
  canonicalDictionaryJson as canonicalJson,
  parseFollowingHydration,
  requireFollowingValue as parsed,
  type CachedDictionaryEffectiveCard,
  type CachedDictionaryHead,
} from './dictionaryFollowingHydration'

import {
  dictionaryModeReconciliationRepository as modeRepository,
  DictionaryModeReconciliationRequiredError,
  type DictionaryReviewedModeDecision,
} from './dictionaryModeReconciliationRepository'

export type { CachedDictionaryEffectiveCard } from './dictionaryFollowingHydration'

type Database = Awaited<ReturnType<typeof getDatabase>>
const CHUNK_SIZE = 400

export interface DictionaryHydrationRequest {
  userId: string
  wordIds: readonly string[]
  refreshVersions: ReadonlyMap<string, number>
}

interface CacheRow {
  word_id: string
  card_json: string
  watermark: string
  cached_entry_id: string | null
  cached_revision_id: string | null
  cached_mode: string
  cached_content_version: string
  cached_head_sequence: string | null
  revision_id: string | null
  entry_id: string | null
  revision_no: number | null
  schema_version: number | null
  content_json: string | null
  content_sha256: string | null
  cefr_input_sha256: string | null
  review_status: string | null
}

const readRevision = (row: CacheRow): unknown =>
  row.revision_id === null
    ? null
    : {
        revision_id: row.revision_id,
        entry_id: row.entry_id,
        revision_no: row.revision_no,
        schema_version: row.schema_version,
        content: JSON.parse(row.content_json ?? 'null') as unknown,
        content_sha256: row.content_sha256,
        cefr_input_sha256: row.cefr_input_sha256,
        review_status: row.review_status,
      }

const insertRevision = async (
  transaction: Database,
  revision: DictionaryRevision,
  cachedAt: string
): Promise<void> => {
  const contentJson = canonicalJson(revision.content)
  await transaction.runAsync(
    `INSERT OR IGNORE INTO dictionary_revision_cache(revision_id, entry_id,
      revision_no, schema_version, content_json, content_sha256,
      cefr_input_sha256, review_status, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    revision.revision_id,
    revision.entry_id,
    revision.revision_no,
    revision.schema_version,
    contentJson,
    revision.content_sha256,
    revision.cefr_input_sha256,
    revision.review_status,
    cachedAt
  )
  const existing = await transaction.getFirstAsync<CacheRow>(
    'SELECT * FROM dictionary_revision_cache WHERE revision_id = ?',
    [revision.revision_id]
  )
  if (
    !existing ||
    existing.entry_id !== revision.entry_id ||
    existing.revision_no !== revision.revision_no ||
    existing.schema_version !== revision.schema_version ||
    existing.review_status !== revision.review_status ||
    existing.content_sha256 !== revision.content_sha256 ||
    existing.cefr_input_sha256 !== revision.cefr_input_sha256 ||
    existing.content_json !== contentJson
  )
    throw new Error('Dictionary revision identity conflict')
}

const requireReviewedModeReturn = (
  previous: { mode: string; content_version: string } | null,
  card: CachedDictionaryEffectiveCard['card'],
  reviewedWordId?: string
): void => {
  if (previous?.mode !== 'follow' || card.mode === 'follow') return
  if (reviewedWordId !== card.word_id)
    throw new DictionaryModeReconciliationRequiredError(card.word_id)
  if (
    compareDictionarySequences(
      card.content_version,
      previous.content_version
    ) <= 0
  )
    throw new Error('Stale dictionary mode return')
}

export class DictionaryFollowingRepository {
  /** Persist debt before any RPC. A newer refresh request fences a late response. */
  async prepareHydration(
    userId: string,
    requestedIds: readonly string[],
    assertOwner: () => void = () => {}
  ): Promise<DictionaryHydrationRequest> {
    assertOwner()
    const wordIds = boundedIds(requestedIds)
    const refreshVersions = new Map<string, number>()
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      for (const wordId of wordIds) {
        await transaction.runAsync(
          `INSERT INTO dictionary_following_refresh_queue(word_id, user_id, refresh_version)
           VALUES (?, ?, 1) ON CONFLICT(word_id) DO UPDATE SET
             refresh_version = refresh_version + 1
           WHERE user_id = excluded.user_id`,
          wordId,
          userId
        )
        const row = await transaction.getFirstAsync<{
          refresh_version: number
        }>(
          `SELECT refresh_version FROM dictionary_following_refresh_queue
           WHERE word_id = ? AND user_id = ?`,
          [wordId, userId]
        )
        if (!row || !Number.isSafeInteger(row.refresh_version))
          throw new Error('Invalid dictionary refresh owner or version')
        refreshVersions.set(wordId, row.refresh_version)
        // Move the old request into generation-fenced debt before network work.
        // A legacy request arriving after this transaction remains for another run.
        await transaction.runAsync(
          'DELETE FROM dictionary_card_refresh_queue WHERE word_id = ? AND user_id = ?',
          wordId,
          userId
        )
      }
      assertOwner()
    })
    return { userId, wordIds, refreshVersions }
  }

  async getChangeCursor(userId: string): Promise<string> {
    const db = await getDatabase()
    return this.readCursor(db, userId)
  }

  private async readCursor(db: Database, userId: string): Promise<string> {
    const row = await db.getFirstAsync<{ committed_cursor: string }>(
      'SELECT committed_cursor FROM dictionary_following_cursors WHERE user_id = ?',
      [userId]
    )
    return parsed(parseDictionarySequence(row?.committed_cursor ?? '0'))
  }

  async getMissingCardWordIds(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT words.word_id FROM words
       LEFT JOIN dictionary_effective_card_cache cards
         ON cards.word_id = words.word_id AND cards.user_id = words.user_id
       LEFT JOIN dictionary_following_refresh_queue debt
         ON debt.word_id = words.word_id AND debt.user_id = words.user_id
       WHERE words.user_id = ? AND words.deleted_at IS NULL
         AND (cards.word_id IS NULL OR debt.refresh_version > debt.completed_refresh_version)
       ORDER BY words.word_id`,
      [userId]
    )
    return rows.map(row => row.word_id)
  }

  async getPendingRefreshWordIds(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT debt.word_id FROM dictionary_following_refresh_queue debt
       JOIN words ON words.word_id = debt.word_id AND words.user_id = debt.user_id
       WHERE debt.user_id = ? AND words.deleted_at IS NULL
         AND debt.refresh_version > debt.completed_refresh_version`,
      [userId]
    )
    return rows.map(row => row.word_id)
  }

  async getLegacyRefreshWordIds(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT debt.word_id FROM dictionary_card_refresh_queue debt
       JOIN words ON words.word_id = debt.word_id AND words.user_id = debt.user_id
       WHERE debt.user_id = ? AND words.deleted_at IS NULL`,
      [userId]
    )
    return rows.map(row => row.word_id)
  }

  async getWordIdsByEntryIds(
    userId: string,
    entryIds: readonly string[]
  ): Promise<string[]> {
    const db = await getDatabase()
    return this.readAffectedWordIds(db, userId, [...new Set(entryIds)])
  }

  private async readAffectedWordIds(
    db: Database,
    userId: string,
    entryIds: readonly string[]
  ): Promise<string[]> {
    const ids = new Set<string>()
    for (let offset = 0; offset < entryIds.length; offset += CHUNK_SIZE) {
      const chunk = entryIds.slice(offset, offset + CHUNK_SIZE)
      const placeholders = chunk.map(() => '?').join(',')
      const rows = await db.getAllAsync<{ word_id: string }>(
        `SELECT words.word_id FROM words
         LEFT JOIN dictionary_effective_card_cache current
           ON current.word_id = words.word_id AND current.user_id = words.user_id
         LEFT JOIN dictionary_card_content legacy
           ON legacy.word_id = words.word_id AND legacy.user_id = words.user_id
         WHERE words.user_id = ? AND words.deleted_at IS NULL
           AND CASE WHEN current.word_id IS NULL THEN legacy.entry_id ELSE current.entry_id END IN (${placeholders})`,
        [userId, ...chunk]
      )
      rows.forEach(row => ids.add(row.word_id))
    }
    return [...ids].sort()
  }

  /** No RPC or identity await belongs inside this transaction. The synchronous
   * guard checks the caller's captured account before writes and just before commit. */
  async commitHydration(
    request: DictionaryHydrationRequest,
    values: readonly unknown[],
    assertOwner: () => void,
    pageValue?: unknown,
    acknowledgedCommands: readonly DictionaryContentCommand[] = [],
    analysisOperation?: DictionaryAnalysisClientOperation
  ): Promise<void> {
    assertOwner()
    const { cards, revisions, heads, requested, page } =
      parseFollowingHydration(request.wordIds, values, pageValue)
    const db = await getDatabase()
    const cachedAt = new Date().toISOString()
    try {
      await db.withExclusiveTransactionAsync(async transaction => {
        assertOwner()
        if (analysisOperation) {
          const row = await transaction.getFirstAsync<{
            operation_json: string
          }>(
            'SELECT operation_json FROM dictionary_analysis_client_operations WHERE user_id = ? AND word_id = ?',
            [request.userId, analysisOperation.word_id]
          )
          const current = row
            ? parseDictionaryAnalysisClientOperation(
                JSON.parse(row.operation_json) as unknown
              )
            : null
          requireSameAnalysisOperation(current, analysisOperation)
          if (canonicalJson(current) !== canonicalJson(analysisOperation))
            throw new Error('Saved shared analysis publication changed')
        }
        await this.writeHydration(
          transaction,
          request,
          { cards, revisions, heads, requested, page },
          cachedAt,
          assertOwner,
          acknowledgedCommands
        )
      })
    } catch (failure) {
      if (failure instanceof DictionaryModeReconciliationRequiredError)
        await modeRepository.require(
          request.userId,
          failure.wordId,
          assertOwner
        )
      throw failure
    }
  }

  /** The sole mode-return exception is bound to an immutable, reviewed decision.
   * Preservation, command retirement, dependency writes and debt completion roll back together. */
  async commitReviewedMode(
    decision: DictionaryReviewedModeDecision,
    request: DictionaryHydrationRequest,
    values: readonly unknown[],
    assertOwner: () => void
  ): Promise<void> {
    assertOwner()
    if (
      decision.disposition !== 'load-server-preserve-local' ||
      request.userId !== decision.userId ||
      decision.local.word.user_id !== decision.userId ||
      decision.local.word.word_id !== decision.wordId
    )
      throw new Error('Invalid reviewed dictionary owner or word')
    const hydration = parseFollowingHydration(request.wordIds, values)
    const reviewed = parseFollowingHydration(
      [decision.wordId],
      [
        {
          protocol_version: 2,
          watermark: decision.remote.watermark,
          cards: [decision.remote.card],
          revisions: decision.remote.revision ? [decision.remote.revision] : [],
        },
      ]
    ).cards.get(decision.wordId)
    const fresh = hydration.cards.get(decision.wordId)
    if (
      !reviewed ||
      !fresh ||
      canonicalJson(fresh.card) !== canonicalJson(reviewed.card) ||
      canonicalJson(fresh.revision) !== canonicalJson(reviewed.revision) ||
      compareDictionarySequences(fresh.watermark, reviewed.watermark) < 0
    )
      throw new Error('Server content changed. Reload the comparison.')
    const db = await getDatabase()
    const cachedAt = new Date().toISOString()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      if (await modeRepository.isAppliedInTransaction(transaction, decision)) {
        assertOwner()
        return // Recovery confirms the prior decision; never rewinds a later cache.
      }
      const local = await modeRepository.readInTransaction(
        transaction,
        decision.userId,
        decision.wordId,
        assertOwner
      )
      if (canonicalJson(local) !== canonicalJson(decision.local))
        throw new Error('Saved content changed. Reload the comparison.')
      await transaction.runAsync(
        `INSERT INTO dictionary_mode_reconciliations(operation_id, user_id, word_id, decision_json, applied_at)
         VALUES (?, ?, ?, ?, ?)`,
        decision.operationId,
        decision.userId,
        decision.wordId,
        canonicalJson(decision),
        cachedAt
      )
      await transaction.runAsync(
        'DELETE FROM dictionary_content_commands WHERE user_id = ? AND word_id = ?',
        decision.userId,
        decision.wordId
      )
      await this.writeHydration(
        transaction,
        request,
        hydration,
        cachedAt,
        assertOwner,
        [],
        decision.wordId
      )
      await transaction.runAsync(
        'DELETE FROM dictionary_mode_reconciliation_requests WHERE user_id = ? AND word_id = ?',
        decision.userId,
        decision.wordId
      )
      assertOwner()
    })
  }

  private async writeHydration(
    transaction: Database,
    request: DictionaryHydrationRequest,
    hydration: ReturnType<typeof parseFollowingHydration>,
    cachedAt: string,
    assertOwner: () => void,
    acknowledgedCommands: readonly DictionaryContentCommand[],
    reviewedWordId?: string
  ): Promise<void> {
    const { cards, revisions, heads, requested, page } = hydration
    assertOwner()
    if (page) await this.validatePage(transaction, request, page)
    await acknowledgeFollowingCommands(
      transaction,
      request.userId,
      cards,
      acknowledgedCommands
    )
    for (const revision of revisions.values())
      await insertRevision(transaction, revision, cachedAt)
    for (const [entryId, head] of heads)
      await this.saveHead(
        transaction,
        request.userId,
        entryId,
        head,
        requested,
        cachedAt
      )
    for (const item of cards.values())
      await this.saveCard(transaction, request, item, cachedAt, reviewedWordId)
    if (page) {
      await transaction.runAsync(
        `INSERT INTO dictionary_following_cursors(user_id, committed_cursor, updated_at)
           VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
             committed_cursor = excluded.committed_cursor, updated_at = excluded.updated_at`,
        request.userId,
        page.next_cursor,
        cachedAt
      )
    }
    assertOwner()
  }

  private async saveHead(
    transaction: Database,
    userId: string,
    entryId: string,
    head: CachedDictionaryHead,
    requested: ReadonlySet<string>,
    cachedAt: string
  ): Promise<void> {
    const previous = await transaction.getFirstAsync<{
      revision_id: string
      head_sequence: string
      watermark: string
    }>(
      'SELECT revision_id, head_sequence, watermark FROM dictionary_following_heads WHERE user_id = ? AND entry_id = ?',
      [userId, entryId]
    )
    if (
      previous &&
      (compareDictionarySequences(head.sequence, previous.head_sequence) < 0 ||
        (head.sequence === previous.head_sequence &&
          head.revisionId !== previous.revision_id))
    )
      throw new Error('Stale or conflicting dictionary head')
    const unrefreshed = await transaction.getAllAsync<{
      word_id: string
      revision_id: string
      head_sequence: string
      card_json: string
    }>(
      `SELECT cards.word_id, cards.revision_id, cards.head_sequence, cards.card_json FROM dictionary_effective_card_cache cards
           JOIN words ON words.word_id = cards.word_id AND words.user_id = cards.user_id
           WHERE cards.user_id = ? AND cards.entry_id = ? AND cards.mode = 'follow' AND words.deleted_at IS NULL`,
      [userId, entryId]
    )
    if (
      unrefreshed.some(
        row =>
          !requested.has(row.word_id) &&
          (row.revision_id !== head.revisionId ||
            row.head_sequence !== head.sequence ||
            canonicalJson(
              (JSON.parse(row.card_json) as Record<string, unknown>).cefr
            ) !== head.cefrJson)
      )
    )
      throw new Error('Incomplete dictionary entry hydration')
    await transaction.runAsync(
      `INSERT INTO dictionary_following_heads(user_id, entry_id, revision_id, head_sequence, watermark, cached_at)
           VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, entry_id) DO UPDATE SET
           revision_id = excluded.revision_id, head_sequence = excluded.head_sequence,
           watermark = excluded.watermark, cached_at = excluded.cached_at`,
      userId,
      entryId,
      head.revisionId,
      head.sequence,
      previous &&
        compareDictionarySequences(previous.watermark, head.watermark) > 0
        ? previous.watermark
        : head.watermark,
      cachedAt
    )
  }

  private async validatePage(
    transaction: Database,
    request: DictionaryHydrationRequest,
    page: DictionaryChangePageV2
  ): Promise<void> {
    const cursor = await this.readCursor(transaction, request.userId)
    if (cursor !== page.after && cursor !== page.next_cursor)
      throw new Error('Dictionary cursor changed during hydration')
    const affected = await this.readAffectedWordIds(
      transaction,
      request.userId,
      [...new Set(page.changes.map(change => change.entry_id))]
    )
    const requested = new Set(request.wordIds)
    if (affected.some(id => !requested.has(id)))
      throw new Error('Incomplete dictionary change page hydration')
  }

  private async saveCard(
    transaction: Database,
    request: DictionaryHydrationRequest,
    item: CachedDictionaryEffectiveCard,
    cachedAt: string,
    reviewedWordId?: string
  ): Promise<void> {
    const { card, watermark } = item
    const pending = await transaction.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM dictionary_content_commands WHERE user_id = ? AND word_id = ?',
      [request.userId, card.word_id]
    )
    if (pending && pending.count > 0)
      throw new Error('Legacy dictionary commands require reconciliation')
    const debt = await transaction.getFirstAsync<{ refresh_version: number }>(
      'SELECT refresh_version FROM dictionary_following_refresh_queue WHERE user_id = ? AND word_id = ?',
      [request.userId, card.word_id]
    )
    const expected = request.refreshVersions.get(card.word_id)
    if (
      !Number.isSafeInteger(expected) ||
      (expected ?? 0) < 1 ||
      (debt && debt.refresh_version !== expected)
    )
      throw new Error('Dictionary refresh changed during hydration')
    const previous = await transaction.getFirstAsync<{
      mode: string
      content_version: string
      watermark: string
      card_json: string
    }>(
      'SELECT mode, content_version, watermark, card_json FROM dictionary_effective_card_cache WHERE user_id = ? AND word_id = ?',
      [request.userId, card.word_id]
    )
    requireReviewedModeReturn(previous, card, reviewedWordId)

    const cardJson = canonicalJson(card)
    if (
      !debt &&
      (!previous ||
        previous.card_json !== cardJson ||
        previous.watermark !== watermark)
    )
      throw new Error('Dictionary refresh request is unavailable')
    if (
      previous &&
      (compareDictionarySequences(
        card.content_version,
        previous.content_version
      ) < 0 ||
        compareDictionarySequences(watermark, previous.watermark) < 0 ||
        (previous.content_version === card.content_version &&
          previous.watermark === watermark &&
          previous.card_json !== cardJson))
    )
      throw new Error('Stale or conflicting dictionary card')
    await transaction.runAsync(
      `INSERT INTO dictionary_effective_card_cache(word_id, user_id, mode, entry_id,
        revision_id, content_version, head_sequence, watermark, card_json, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(word_id) DO UPDATE SET
        user_id = excluded.user_id, mode = excluded.mode, entry_id = excluded.entry_id,
        revision_id = excluded.revision_id, content_version = excluded.content_version,
        head_sequence = excluded.head_sequence, watermark = excluded.watermark,
        card_json = excluded.card_json, cached_at = excluded.cached_at`,
      card.word_id,
      request.userId,
      card.mode,
      card.reference?.entry_id ?? null,
      card.reference?.revision_id ?? null,
      card.content_version,
      card.head_sequence,
      watermark,
      cardJson,
      cachedAt
    )
    if (card.mode === 'follow')
      await transaction.runAsync(
        'DELETE FROM dictionary_mode_reconciliation_requests WHERE user_id = ? AND word_id = ?',
        request.userId,
        card.word_id
      )
    await transaction.runAsync(
      `UPDATE dictionary_following_refresh_queue SET completed_refresh_version = refresh_version
       WHERE user_id = ? AND word_id = ? AND refresh_version = ?`,
      request.userId,
      card.word_id,
      expected ?? null
    )
  }

  async getCachedCards(
    userId: string,
    requestedIds: readonly string[]
  ): Promise<Map<string, CachedDictionaryEffectiveCard>> {
    return this.mapCachedCards(userId, requestedIds, card => card)
  }

  async mapCachedCards<T>(
    userId: string,
    requestedIds: readonly string[],
    project: (item: CachedDictionaryEffectiveCard) => T
  ): Promise<Map<string, T>> {
    const ids = boundedIds(requestedIds)
    const result = new Map<string, T>()
    if (ids.length === 0) return result
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      for (let offset = 0; offset < ids.length; offset += CHUNK_SIZE) {
        const chunk = ids.slice(offset, offset + CHUNK_SIZE)
        // Send one bounded JSON value across the native SQLite boundary instead
        // of separately converting every cell in hundreds of result objects.
        // The existing strict card/revision parser still validates every row.
        const packed = await transaction.getAllAsync<{ rows_json: string }>(
          `SELECT json_group_array(json_object(
           'word_id', cards.word_id, 'card_json', cards.card_json,
           'watermark', cards.watermark, 'cached_entry_id', cards.entry_id,
           'cached_revision_id', cards.revision_id, 'cached_mode', cards.mode,
           'cached_content_version', cards.content_version,
           'cached_head_sequence', cards.head_sequence,
           'revision_id', revisions.revision_id, 'entry_id', revisions.entry_id,
           'revision_no', revisions.revision_no, 'schema_version', revisions.schema_version,
           'content_json', revisions.content_json, 'content_sha256', revisions.content_sha256,
           'cefr_input_sha256', revisions.cefr_input_sha256,
           'review_status', revisions.review_status
          )) AS rows_json
         FROM dictionary_effective_card_cache cards
         JOIN words ON words.word_id = cards.word_id AND words.user_id = cards.user_id
         LEFT JOIN dictionary_revision_cache revisions ON revisions.entry_id = cards.entry_id AND revisions.revision_id = cards.revision_id
         WHERE cards.user_id = ? AND words.deleted_at IS NULL AND cards.word_id IN (${chunk.map(() => '?').join(',')})`,
          [userId, ...chunk]
        )
        const rows = JSON.parse(packed[0].rows_json) as CacheRow[]
        for (const row of rows) {
          const revision = readRevision(row)
          const batch: DictionaryEffectiveBatchV2 = parsed(
            parseDictionaryEffectiveBatchV2({
              protocol_version: 2,
              watermark: row.watermark,
              cards: [JSON.parse(row.card_json) as unknown],
              revisions: revision === null ? [] : [revision],
            })
          )
          const card = batch.cards[0]
          if (
            card.word_id !== row.word_id ||
            card.mode !== row.cached_mode ||
            card.content_version !== row.cached_content_version ||
            card.head_sequence !== row.cached_head_sequence ||
            (card.reference?.entry_id ?? null) !== row.cached_entry_id ||
            (card.reference?.revision_id ?? null) !== row.cached_revision_id
          )
            throw new Error('Dictionary cached card identity conflict')
          // Project only after validation. A display reader can release raw
          // revisions between chunks instead of retaining a second full cache.
          result.set(
            row.word_id,
            project({
              card: batch.cards[0],
              revision: batch.revisions[0] ?? null,
              watermark: batch.watermark,
            })
          )
        }
      }
    })
    return result
  }
}

export const dictionaryFollowingRepository = new DictionaryFollowingRepository()
