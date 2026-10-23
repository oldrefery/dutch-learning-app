import { getDatabase } from './initDB'
import {
  canonicalDictionaryJson,
  type CachedDictionaryEffectiveCard,
} from './dictionaryFollowingHydration'

const UNAVAILABLE = 'Conflict word is unavailable'

type Database = Awaited<ReturnType<typeof getDatabase>>

export interface DictionaryModeLocalSnapshot {
  word: { word_id: string; user_id: string; collection_id: string | null }
  wordContent: Record<string, unknown>
  privateState: Record<string, unknown> | null
  cachedState: Record<string, unknown> | null
  privateRevision: Record<string, unknown> | null
  cachedRevision: Record<string, unknown> | null
  requiredState: Record<string, unknown> | null
  commands: Record<string, unknown>[]
}

export interface DictionaryReviewedModeDecision {
  disposition: 'load-server-preserve-local'
  operationId: string
  userId: string
  wordId: string
  local: DictionaryModeLocalSnapshot
  remote: CachedDictionaryEffectiveCard
}

export class DictionaryModeReconciliationRequiredError extends Error {
  constructor(readonly wordId: string) {
    super('Dictionary mode requires reviewed reconciliation')
    this.name = 'DictionaryModeReconciliationRequiredError'
  }
}

const readInTransaction = async (
  transaction: Database,
  userId: string,
  wordId: string,
  assertCurrent: () => void
): Promise<DictionaryModeLocalSnapshot> => {
  assertCurrent()
  const word = await transaction.getFirstAsync<
    DictionaryModeLocalSnapshot['word']
  >(
    `SELECT word_id, user_id, collection_id FROM words
     WHERE user_id = ? AND word_id = ? AND deleted_at IS NULL`,
    [userId, wordId]
  )
  if (!word) throw new Error(UNAVAILABLE)
  const wordContent = await transaction.getFirstAsync<Record<string, unknown>>(
    `SELECT dutch_lemma, dutch_original, part_of_speech, is_irregular,
      is_reflexive, is_expression, expression_type, is_separable, prefix_part,
      root_verb, article, plural, register, translations, examples, synonyms,
      antonyms, conjugation, preposition, image_url, tts_url, analysis_notes, usage_notes
     FROM words WHERE user_id = ? AND word_id = ?`,
    [userId, wordId]
  )
  if (!wordContent) throw new Error(UNAVAILABLE)
  const privateState = await transaction.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM dictionary_card_content WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
  const cachedState = await transaction.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM dictionary_effective_card_cache WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
  const privateRevision = await transaction.getFirstAsync<
    Record<string, unknown>
  >(
    `SELECT revisions.* FROM dictionary_revision_cache revisions
     JOIN dictionary_card_content cards ON cards.revision_id = revisions.revision_id
     AND cards.entry_id = revisions.entry_id WHERE cards.user_id = ? AND cards.word_id = ?`,
    [userId, wordId]
  )
  const cachedRevision = await transaction.getFirstAsync<
    Record<string, unknown>
  >(
    `SELECT revisions.* FROM dictionary_revision_cache revisions
     JOIN dictionary_effective_card_cache cards ON cards.revision_id = revisions.revision_id
     AND cards.entry_id = revisions.entry_id WHERE cards.user_id = ? AND cards.word_id = ?`,
    [userId, wordId]
  )
  const requiredState = await transaction.getFirstAsync<
    Record<string, unknown>
  >(
    'SELECT * FROM dictionary_mode_reconciliation_requests WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
  const commands = await transaction.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM dictionary_content_commands WHERE user_id = ? AND word_id = ? ORDER BY sequence`,
    [userId, wordId]
  )
  assertCurrent()
  return {
    word,
    wordContent,
    privateState,
    cachedState,
    privateRevision,
    cachedRevision,
    requiredState,
    commands,
  }
}

export const dictionaryModeReconciliationRepository = {
  readInTransaction,
  async read(
    userId: string,
    wordId: string,
    assertCurrent: () => void
  ): Promise<DictionaryModeLocalSnapshot> {
    assertCurrent()
    const db = await getDatabase()
    let result: DictionaryModeLocalSnapshot | null = null
    await db.withExclusiveTransactionAsync(async transaction => {
      result = await readInTransaction(
        transaction,
        userId,
        wordId,
        assertCurrent
      )
    })
    if (!result) throw new Error(UNAVAILABLE)
    assertCurrent()
    return result
  },
  async getProtectedDecisions(
    userId: string,
    wordId: string
  ): Promise<DictionaryReviewedModeDecision[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ decision_json: string }>(
      'SELECT decision_json FROM dictionary_mode_reconciliations WHERE user_id = ? AND word_id = ? ORDER BY applied_at, operation_id',
      [userId, wordId]
    )
    return rows.map(
      row => JSON.parse(row.decision_json) as DictionaryReviewedModeDecision
    )
  },
  async getSelectedWordIds(userId: string): Promise<Set<string>> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      'SELECT DISTINCT word_id FROM dictionary_mode_reconciliations WHERE user_id = ?',
      [userId]
    )
    return new Set(rows.map(row => row.word_id))
  },
  async getRequiredWordIds(userId: string): Promise<Set<string>> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      'SELECT word_id FROM dictionary_mode_reconciliation_requests WHERE user_id = ?',
      [userId]
    )
    return new Set(rows.map(row => row.word_id))
  },
  async require(
    userId: string,
    wordId: string,
    assertCurrent: () => void
  ): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertCurrent()
      await transaction.runAsync(
        `INSERT OR IGNORE INTO dictionary_mode_reconciliation_requests(word_id, user_id)
         SELECT word_id, user_id FROM words WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`,
        wordId,
        userId
      )
      assertCurrent()
    })
  },
  async isApplied(decision: DictionaryReviewedModeDecision): Promise<boolean> {
    return this.isAppliedInTransaction(await getDatabase(), decision)
  },
  async isAppliedInTransaction(
    transaction: Database,
    decision: DictionaryReviewedModeDecision
  ): Promise<boolean> {
    const row = await transaction.getFirstAsync<{
      user_id: string
      decision_json: string
    }>(
      'SELECT user_id, decision_json FROM dictionary_mode_reconciliations WHERE operation_id = ?',
      [decision.operationId]
    )
    if (!row) return false
    if (
      row.user_id !== decision.userId ||
      row.decision_json !== canonicalDictionaryJson(decision)
    )
      throw new Error('Protected dictionary decision identity conflict')
    return true
  },
}
