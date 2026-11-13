import { getDatabase } from './initDB'
import {
  isDictionaryContentEnabled,
  isDictionaryFollowingEnabled,
} from '@/constants/dictionaryContent'
import type {
  SQLiteBindValue,
  SQLiteDatabase,
  SQLiteStatement,
} from 'expo-sqlite'
import { Word } from '@/types/database'
import type { SyncStatus } from './schema'
import { Sentry } from '@/lib/sentry'
import {
  addLocalCalendarDays,
  DICTIONARY_CONTENT_PROTOCOL_VERSION,
  parseDictionaryContentOverrides,
  parseDictionaryReference,
  parseDictionaryContent,
  toLocalDateKey,
  type DictionaryContentCommand,
  type DictionaryReference,
  type DictionaryImportSource,
} from '@woordenaar/domain'
import { randomUUID } from 'expo-crypto'
import { wordToDictionaryContent } from './dictionaryContentMapping'
import { recordExplicitImportMove } from './dictionaryImportPlacementRepository'
import { queueImportDeletion } from './dictionaryImportDeletionRepository'
import { dictionaryImportRepository } from './dictionaryImportRepository'
import { canonicalDictionaryJson } from './dictionaryFollowingHydration'

import {
  comparePersonalTimestamps,
  personalStorageWord,
  type PersonalMetadataRow,
  requirePersonalBootstrap,
} from './dictionaryPersonalMetadata'
import { WORD_CONTENT_READY } from './dictionaryPersonalStateSchema'
import { dictionaryFollowingRepository } from './dictionaryFollowingRepository'
import { applyDictionaryMaterialization } from './dictionaryWordMaterialization'

const PERSONAL_OWNER_MISMATCH = 'Personal metadata owner mismatch'

const READABLE_WORD_COLUMNS = `words.*, (SELECT sparse FROM dictionary_personal_state s
  WHERE s.word_id = words.word_id AND s.user_id = words.user_id) AS personal_sparse`

type PersonalState = {
  mode: string
  entry_id: string | null
  adopted_revision_id: string | null
  content_version: string
  observed_updated_at: string
  sparse: number
}

const matchesPersonalState = (
  state: PersonalState,
  row: PersonalMetadataRow
): boolean =>
  state.mode === row.dictionary_content_mode &&
  state.entry_id === row.dictionary_entry_id &&
  state.adopted_revision_id === row.dictionary_revision_id &&
  state.content_version === row.content_version

const requireDictionaryOverrides = (value: unknown) => {
  const result = parseDictionaryContentOverrides(value)
  if (!result.success) throw new Error('Invalid local dictionary overrides')
  return result.data
}

export interface LocalWord extends Word {
  sync_status: SyncStatus
  deleted_at: string | null
  last_sync_attempt_at: string | null
  synced_at: string | null
}

// Type for existing word check result
interface ExistingWordCheck {
  word_id: string
  sync_status: SyncStatus
  updated_at: string
  deleted_at: string | null
  has_pending_learning?: number
  has_pending_dictionary?: number
  has_pending_import?: number
  has_dictionary_content?: number
}

interface SaveWordsOptions {
  preserveUnsynced?: boolean
  syncedAt?: string
  completePersonalRead?: boolean
}

interface SaveWordStatements {
  checkExisting: SQLiteStatement
  update: SQLiteStatement
  insert: SQLiteStatement
}

interface MergedWord {
  dutch_lemma: string
  existing_id: string
  incoming_id: string
}

interface DictionaryCardVersion {
  content_version: number
}

interface DictionaryCardEditState extends DictionaryCardVersion {
  overrides_json: string
}

export interface RemoteWordTombstone extends Word {
  deleted_at: string
}

export interface WordSyncAcknowledgement {
  word_id: string
  updated_at: string
  deleted_at: string | null
}

export interface WordSyncVersion {
  word_id: string
  updated_at: string
}

const UNSYNCED_STATUSES = new Set<SyncStatus>([
  'pending',
  'error',
  'conflict',
  'deleted',
])

// A review marks the legacy word pending as well as queueing its event. Only
// consider that residue after the event and every other local operation settle.
const ACKNOWLEDGED_LEARNING_WORD_SQL = `
  SELECT words.* FROM words
  WHERE user_id = ? AND sync_status = 'pending' AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM review_events e
      WHERE e.user_id = words.user_id AND e.word_id = words.word_id
        AND e.sync_status = 'synced'
        AND julianday(e.reviewed_at) = julianday(words.last_reviewed_at)
        AND julianday(e.reviewed_at) = julianday(words.updated_at))
    AND NOT EXISTS (SELECT 1 FROM learning_commands l WHERE l.word_id = words.word_id)
    AND NOT EXISTS (SELECT 1 FROM review_events e
      WHERE e.word_id = words.word_id AND e.sync_status <> 'synced')
    AND NOT EXISTS (SELECT 1 FROM review_corrections r
      WHERE r.word_id = words.word_id AND r.status <> 'synced' AND r.resolved_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM review_correction_recovery r WHERE r.word_id = words.word_id)
    AND NOT EXISTS (SELECT 1 FROM dictionary_content_commands c WHERE c.word_id = words.word_id)
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_intents i WHERE i.word_id = words.word_id)
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = words.word_id)
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id
      AND (d.acknowledged_placement_revision IS NULL OR d.local_placement_revision > d.acknowledged_placement_revision))
`

const CHECK_EXISTING_WORD_SQL = `
  SELECT word_id, sync_status, updated_at, deleted_at,
    EXISTS(SELECT 1 FROM learning_commands WHERE learning_commands.word_id = words.word_id) AS has_pending_learning,
    EXISTS(SELECT 1 FROM dictionary_content_commands WHERE dictionary_content_commands.word_id = words.word_id) AS has_pending_dictionary,
    (EXISTS(SELECT 1 FROM dictionary_import_intents WHERE dictionary_import_intents.word_id = words.word_id)
     OR EXISTS(SELECT 1 FROM dictionary_import_recovery_outbox WHERE dictionary_import_recovery_outbox.word_id = words.word_id)
     OR EXISTS(SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id
       AND (d.acknowledged_placement_revision IS NULL OR d.local_placement_revision > d.acknowledged_placement_revision))) AS has_pending_import,
    EXISTS(SELECT 1 FROM dictionary_card_content WHERE dictionary_card_content.word_id = words.word_id) AS has_dictionary_content
  FROM words
  WHERE user_id = ?
    AND (
      word_id = ?
      OR (
        deleted_at IS NULL
        AND
        LOWER(dutch_lemma) = LOWER(?)
        AND COALESCE(part_of_speech, 'unknown') = ?
        AND COALESCE(article, '') = ?
      )
    )
  ORDER BY CASE WHEN word_id = ? THEN 0 ELSE 1 END
  LIMIT 1
`

const UPDATE_WORD_SQL = `
  UPDATE words SET
    word_id = ?,
    collection_id = ?,
    dutch_lemma = ?,
    dutch_original = ?,
    part_of_speech = ?,
    is_irregular = ?,
    is_reflexive = ?,
    is_expression = ?,
    expression_type = ?,
    is_separable = ?,
    prefix_part = ?,
    root_verb = ?,
    article = ?,
    plural = ?,
    register = ?,
    translations = ?,
    examples = ?,
    synonyms = ?,
    antonyms = ?,
    conjugation = ?,
    preposition = ?,
    image_url = ?,
    tts_url = ?,
    interval_days = ?,
    repetition_count = ?,
    easiness_factor = ?,
    next_review_date = ?,
    last_reviewed_at = ?,
    analysis_notes = ?,
    usage_notes = ?,
    created_at = ?,
    updated_at = ?,
    deleted_at = ?,
    sync_status = ?,
    last_sync_attempt_at = COALESCE(?, last_sync_attempt_at),
    synced_at = ?
  WHERE word_id = ? AND user_id = ?
    AND deleted_at IS NULL AND sync_status <> 'deleted'
    AND (? = 0 OR (
      sync_status = 'synced'
      AND NOT EXISTS (SELECT 1 FROM learning_commands l WHERE l.word_id = words.word_id)
      AND NOT EXISTS (SELECT 1 FROM dictionary_content_commands c WHERE c.word_id = words.word_id)
      AND NOT EXISTS (SELECT 1 FROM dictionary_import_intents i WHERE i.word_id = words.word_id)
      AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = words.word_id)
      AND NOT EXISTS (SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id
        AND (d.acknowledged_placement_revision IS NULL OR d.local_placement_revision > d.acknowledged_placement_revision))
    ))
`

const INSERT_WORD_SQL = `
  INSERT INTO words (
    word_id, user_id, collection_id, dutch_lemma, dutch_original,
    part_of_speech, is_irregular, is_reflexive, is_expression,
    expression_type, is_separable, prefix_part, root_verb, article,
    plural, register, translations, examples, synonyms, antonyms, conjugation,
    preposition, image_url, tts_url, interval_days, repetition_count,
    easiness_factor, next_review_date, last_reviewed_at, analysis_notes,
    usage_notes,
    created_at, updated_at, deleted_at, sync_status,
    last_sync_attempt_at, synced_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`

const UPDATE_ANALYZED_WORD_SQL = `
  UPDATE words SET
    dutch_lemma = ?,
    dutch_original = ?,
    part_of_speech = ?,
    is_irregular = ?,
    is_reflexive = ?,
    is_expression = ?,
    expression_type = ?,
    is_separable = ?,
    prefix_part = ?,
    root_verb = ?,
    article = ?,
    plural = ?,
    register = ?,
    translations = ?,
    examples = ?,
    synonyms = ?,
    antonyms = ?,
    conjugation = ?,
    preposition = ?,
    image_url = ?,
    tts_url = ?,
    analysis_notes = ?,
    usage_notes = ?,
    updated_at = ?,
    sync_status = 'pending',
    last_sync_attempt_at = NULL,
    synced_at = NULL
  WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL
`

const UPSERT_WORD_TOMBSTONE_SQL = `
  ${INSERT_WORD_SQL}
  ON CONFLICT(word_id) DO UPDATE SET
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at,
    sync_status = 'synced'
  WHERE words.user_id = excluded.user_id
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_intents i WHERE i.word_id = words.word_id)
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = words.word_id)
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id
      AND (d.acknowledged_placement_revision IS NULL OR d.local_placement_revision > d.acknowledged_placement_revision))
`

export class WordRepository {
  // Helper to convert undefined to null for SQLite
  private toSqlValue<T>(value: T | undefined): T | null {
    return value === undefined ? null : value
  }

  private toNullableSqlValue(value: string | null | undefined): string | null {
    return value || null
  }

  async getAcknowledgedLearningWordIds(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT word_id FROM (${ACKNOWLEDGED_LEARNING_WORD_SQL})`,
      [userId]
    )
    return rows.map(row => row.word_id)
  }

  async reconcileAcknowledgedLearning(
    userId: string,
    canonicalWords: Word[]
  ): Promise<void> {
    if (canonicalWords.length === 0) return
    const db = await getDatabase()
    const syncedAt = new Date().toISOString()
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const canonical of canonicalWords) {
        if (canonical.user_id !== userId) continue
        const row = await transaction.getFirstAsync<Record<string, unknown>>(
          `${ACKNOWLEDGED_LEARNING_WORD_SQL} AND words.word_id = ?`,
          [userId, canonical.word_id]
        )
        if (!row) continue
        const local = this.parseWordRow(row)
        // Timestamp equality with the event alone cannot prove a learning-only
        // change: a review may have overwritten an earlier content-edit timestamp.
        // Compare every persisted content, placement and SRS value instead.
        const comparable = (word: Word) =>
          this.getContentAndProgressValues(
            {
              ...word,
              last_reviewed_at: word.last_reviewed_at
                ? new Date(word.last_reviewed_at).toISOString()
                : null,
            },
            canonicalDictionaryJson
          )
        if (
          JSON.stringify(comparable(local)) !==
          JSON.stringify(comparable(canonical))
        )
          continue
        await transaction.runAsync(
          `UPDATE words SET sync_status = 'synced', updated_at = ?,
            last_sync_attempt_at = ?, synced_at = ?
           WHERE word_id = ? AND user_id = ?`,
          canonical.updated_at,
          syncedAt,
          syncedAt,
          canonical.word_id,
          userId
        )
      }
    })
  }

  async saveWords(
    words: Word[],
    options: SaveWordsOptions = {}
  ): Promise<void> {
    const db = await getDatabase()
    if (options.completePersonalRead) {
      await db.withExclusiveTransactionAsync(async transaction => {
        const statements = await this.prepareSaveWordStatements(transaction)
        try {
          for (const word of words) {
            await this.restoreFullPersonalRow(transaction, statements, word)
            await this.persistWord(word, statements, options)
          }
        } finally {
          await this.finalizeSaveWordStatements(statements)
        }
      })
      return
    }
    const statements = await this.prepareSaveWordStatements(db)

    try {
      const mergedWords = await this.persistWords(words, statements, options)
      this.logMergedWords(mergedWords)
    } finally {
      await this.finalizeSaveWordStatements(statements)
    }
  }

  /** Exact personal identity only; no semantic merge or resurrection. The whole
   * pull and its refresh debt commit under one captured owner lifetime. */
  async saveFollowingPersonalWord(
    word: Word,
    assertOwner: () => void
  ): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const existing = await transaction.getFirstAsync<
        ExistingWordCheck & { user_id: string }
      >('SELECT * FROM words WHERE word_id = ?', [word.word_id])
      if (
        existing &&
        (existing.user_id !== word.user_id ||
          existing.deleted_at ||
          existing.sync_status === 'deleted')
      )
        throw new Error(
          'Imported personal row is deleted or belongs to another owner'
        )
      if (word.collection_id) {
        const collection = await transaction.getFirstAsync<{
          collection_id: string
        }>(
          "SELECT collection_id FROM collections WHERE collection_id = ? AND user_id = ? AND sync_status <> 'deleted'",
          [word.collection_id, word.user_id]
        )
        if (!collection)
          throw new Error('Imported collection must be synchronized first')
      }
      const statements = await this.prepareSaveWordStatements(transaction)
      try {
        const matched = await this.findExistingWord(
          statements.checkExisting,
          word
        )
        if (matched && matched.word_id !== word.word_id)
          throw new Error(
            'Personal word identity conflict. Existing card is preserved.'
          )
        await this.restoreFullPersonalRow(transaction, statements, word)
        // A response fetched before a newer local/remote merge must not move it back.
        if (
          !existing ||
          Date.parse(existing.updated_at) <= Date.parse(word.updated_at)
        )
          await this.persistWord(word, statements, { preserveUnsynced: true })
        await transaction.runAsync(
          `INSERT INTO dictionary_following_refresh_queue(word_id,user_id,refresh_version)
           VALUES (?,?,1) ON CONFLICT(word_id) DO UPDATE SET refresh_version = refresh_version + 1
           WHERE user_id = excluded.user_id`,
          word.word_id,
          word.user_id
        )
        assertOwner()
      } finally {
        await this.finalizeSaveWordStatements(statements)
      }
      assertOwner()
    })
  }

  async getSparsePersonalWordIds(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT s.word_id FROM dictionary_personal_state s JOIN words w ON w.word_id=s.word_id
       AND w.user_id=s.user_id WHERE s.user_id=? AND s.sparse=1 AND w.deleted_at IS NULL
       AND w.sync_status <> 'deleted' ORDER BY s.word_id`,
      userId
    )
    return rows.map(row => row.word_id)
  }

  async getPersonalBootstrapWordIds(
    userId: string,
    rows: readonly PersonalMetadataRow[]
  ): Promise<string[]> {
    const db = await getDatabase()
    const requested = rows.filter(
      row => !row.deleted_at && row.dictionary_content_mode === 'follow'
    )
    if (rows.some(row => row.user_id !== userId))
      throw new Error(PERSONAL_OWNER_MISMATCH)
    const required: string[] = []
    for (let offset = 0; offset < requested.length; offset += 400) {
      const chunk = requested
        .slice(offset, offset + 400)
        .map(row => row.word_id)
      const existing = await db.getAllAsync<{
        word_id: string
        sparse: number | null
      }>(
        `SELECT w.word_id,s.sparse FROM words w LEFT JOIN dictionary_personal_state s ON s.word_id=w.word_id
         WHERE w.user_id=? AND w.word_id IN (${chunk.map(() => '?').join(',')})`,
        userId,
        ...chunk
      )
      const complete = new Set(
        existing.filter(row => row.sparse !== 1).map(row => row.word_id)
      )
      required.push(...chunk.filter(id => !complete.has(id)))
    }
    return required
  }

  private async restorePersonalBaseline(
    transaction: SQLiteDatabase,
    statements: SaveWordStatements,
    word: Word,
    placeholder?: Word
  ): Promise<boolean> {
    const raw = await transaction.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE word_id=? AND user_id=?',
      [word.word_id, word.user_id]
    )
    if (!raw || raw.deleted_at || raw.sync_status === 'deleted') return false
    const command = await transaction.getFirstAsync(
      'SELECT 1 FROM dictionary_content_commands WHERE word_id=? AND user_id=?',
      [word.word_id, word.user_id]
    )
    if (command)
      throw new Error(
        'Personal bootstrap conflicts with a pending content edit'
      )
    const existing = this.parseWordRow(raw)
    // Repair only the old synthetic lexical copy; retain all personal study,
    // placement, identity and delivery state, including in-flight commands.
    const withLocalState = (content: Word): Word => ({
      ...content,
      word_id: existing.word_id,
      user_id: existing.user_id,
      collection_id: existing.collection_id,
      dutch_lemma: existing.dutch_lemma,
      part_of_speech: existing.part_of_speech,
      article: existing.article,
      interval_days: existing.interval_days,
      repetition_count: existing.repetition_count,
      easiness_factor: existing.easiness_factor,
      next_review_date: existing.next_review_date,
      last_reviewed_at: existing.last_reviewed_at,
      created_at: existing.created_at,
      updated_at: existing.updated_at,
    })
    const restored = withLocalState(word)
    if (placeholder) {
      const comparable = (value: Word) =>
        JSON.stringify(
          this.getContentAndProgressValues(value, canonicalDictionaryJson)
        )
      const current = comparable(existing)
      // A pending review can coexist with an older unsent lexical edit.
      // Only replace the synthetic copy or a copy that already matches.
      if (
        current !== comparable(withLocalState(placeholder)) &&
        current !== comparable(restored)
      )
        return false
    }
    const result = await statements.update.executeAsync(
      existing.word_id,
      ...this.getMutableWordValues(
        restored,
        existing.deleted_at,
        existing.sync_status,
        existing.synced_at
      ),
      existing.word_id,
      existing.user_id,
      0
    )
    return result.changes === 1
  }

  private async restoreFullPersonalRow(
    transaction: SQLiteDatabase,
    statements: SaveWordStatements,
    word: Word
  ): Promise<void> {
    const state = await transaction.getFirstAsync<PersonalState>(
      'SELECT * FROM dictionary_personal_state WHERE word_id=? AND user_id=?',
      [word.word_id, word.user_id]
    )
    if (!state) return
    if (
      comparePersonalTimestamps(word.updated_at, state.observed_updated_at) < 0
    )
      throw new Error('Stale full personal row')
    if (state.sparse)
      await this.restorePersonalBaseline(transaction, statements, word)
    // A complete personal response restores the old-reader contract. Retain a
    // fresh hydration generation, but retire the obsolete metadata-only fence.
    await transaction.runAsync(
      `INSERT INTO dictionary_following_refresh_queue(word_id,user_id,refresh_version)
      VALUES (?,?,1) ON CONFLICT(word_id) DO UPDATE SET refresh_version=refresh_version+1
      WHERE user_id=excluded.user_id`,
      word.word_id,
      word.user_id
    )
    await transaction.runAsync(
      'DELETE FROM dictionary_personal_state WHERE word_id=? AND user_id=?',
      word.word_id,
      word.user_id
    )
  }

  async savePersonalMetadata(
    userId: string,
    rows: readonly PersonalMetadataRow[],
    assertOwner: () => void,
    exactImport = false,
    bootstrapVersions?: ReadonlyMap<string, number>
  ): Promise<ReadonlyMap<string, number>> {
    const db = await getDatabase()
    const syncedAt = new Date().toISOString()
    let savedVersions = new Map<string, number>()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const bootstrapIds = [...(bootstrapVersions?.keys() ?? [])]
      const before = await dictionaryFollowingRepository.readBootstrapVersions(
        userId,
        bootstrapIds,
        transaction
      )
      const appliedBootstrapIds: string[] = []
      const statements = await this.prepareSaveWordStatements(transaction)
      const tombstones = await transaction.prepareAsync(
        UPSERT_WORD_TOMBSTONE_SQL
      )
      try {
        for (const row of rows) {
          assertOwner()
          if (row.user_id !== userId) throw new Error(PERSONAL_OWNER_MISMATCH)
          const existing = await transaction.getFirstAsync<
            ExistingWordCheck & { user_id: string }
          >(
            'SELECT user_id, word_id, updated_at, deleted_at, sync_status FROM words WHERE word_id = ?',
            [row.word_id]
          )
          if (existing && existing.user_id !== userId)
            throw new Error(PERSONAL_OWNER_MISMATCH)
          if (
            exactImport &&
            (existing?.deleted_at || existing?.sync_status === 'deleted')
          )
            throw new Error('Imported personal row is deleted')
          if (row.deleted_at) {
            await tombstones.executeAsync(
              ...this.getInsertValues(
                personalStorageWord(row),
                row.deleted_at,
                'synced',
                syncedAt
              )
            )
            continue
          }
          if (existing?.deleted_at || existing?.sync_status === 'deleted')
            continue
          const applied = await this.applyPersonalMetadata(
            transaction,
            statements,
            row,
            existing,
            syncedAt
          )
          if (applied) appliedBootstrapIds.push(row.word_id)
        }
        assertOwner()
      } finally {
        await this.finalizeSaveWordStatements(statements)
        await tombstones.finalizeAsync()
      }
      savedVersions = await dictionaryFollowingRepository.readBootstrapVersions(
        userId,
        appliedBootstrapIds.filter(
          id => before.has(id) && before.get(id) === bootstrapVersions?.get(id)
        ),
        transaction
      )
      assertOwner()
    })
    return savedVersions
  }

  private async preparePersonalStorage(
    transaction: SQLiteDatabase,
    statements: SaveWordStatements,
    row: PersonalMetadataRow,
    state: PersonalState | null,
    existing: ExistingWordCheck | null
  ) {
    const needsBaseline =
      row.dictionary_content_mode === 'follow' &&
      (!existing || state?.sparse === 1)
    const baseline = needsBaseline
      ? requirePersonalBootstrap(row.bootstrapWord, row)
      : undefined
    if (
      existing &&
      baseline &&
      !(await this.restorePersonalBaseline(
        transaction,
        statements,
        baseline,
        existing.sync_status === 'pending'
          ? personalStorageWord(row)
          : undefined
      ))
    )
      throw new Error(
        'Personal bootstrap conflicts with a pending content edit'
      )
    return { storage: baseline ?? personalStorageWord(row), baseline }
  }

  private async saveCompleteLegacyPersonalRow(
    transaction: SQLiteDatabase,
    statements: SaveWordStatements,
    row: PersonalMetadataRow,
    word: Word,
    match: ExistingWordCheck | null,
    sparse: number,
    syncedAt: string
  ): Promise<boolean> {
    const options = { preserveUnsynced: true, syncedAt }
    if (sparse && match && this.shouldPreserveExistingWord(match, options)) {
      if (match.has_pending_dictionary || match.has_pending_import) return false
      return this.restorePersonalBaseline(
        transaction,
        statements,
        word,
        personalStorageWord({ ...row, legacyWord: undefined })
      )
    }
    return (await this.persistWord(word, statements, options)) !== null
  }

  private async applyPersonalMetadata(
    transaction: SQLiteDatabase,
    statements: SaveWordStatements,
    row: PersonalMetadataRow,
    existing: ExistingWordCheck | null,
    syncedAt: string
  ): Promise<boolean> {
    const {
      user_id: owner,
      word_id: id,
      dictionary_content_mode: mode,
      dictionary_entry_id: entry,
      dictionary_revision_id: adopted,
      content_version: version,
    } = row
    const state = await transaction.getFirstAsync<PersonalState>(
      'SELECT * FROM dictionary_personal_state WHERE word_id = ? AND user_id = ?',
      [id, owner]
    )
    const observed =
      state?.observed_updated_at ??
      (existing?.sync_status === 'synced' ? existing.updated_at : null)
    if (observed && comparePersonalTimestamps(row.updated_at, observed) < 0)
      return false
    await this.requirePersonalCollection(transaction, row.collection_id, owner)
    const { storage, baseline } = await this.preparePersonalStorage(
      transaction,
      statements,
      row,
      state,
      existing
    )
    const match = await this.findExistingWord(statements.checkExisting, storage)
    if (match && match.word_id !== id)
      throw new Error(
        'Personal word identity conflict. Existing card is preserved.'
      )
    const cache = await transaction.getFirstAsync<{
      mode: string
      entry_id: string | null
      adopted: string | null
      content_version: string
    }>(
      `SELECT mode, entry_id, json_extract(card_json, '$.adopted_revision_id') AS adopted, content_version
       FROM dictionary_effective_card_cache WHERE word_id = ? AND user_id = ?`,
      [id, owner]
    )
    const { bindingMatches, cacheCurrent, sparse, pending } =
      this.personalReadiness(row, cache, state, Boolean(existing))
    let complete = Boolean(baseline)
    if (!existing) {
      await statements.insert.executeAsync(
        ...this.getInsertValues(storage, null, 'synced', syncedAt)
      )
    } else if (row.legacyWord && !pending) {
      complete = await this.saveCompleteLegacyPersonalRow(
        transaction,
        statements,
        row,
        storage,
        match,
        sparse,
        syncedAt
      )
    } else {
      await this.applyPersonalFields(
        transaction,
        row,
        match,
        mode === 'follow' && bindingMatches
      )
    }
    await transaction.runAsync(
      `INSERT INTO dictionary_personal_state(word_id,user_id,mode,entry_id,adopted_revision_id,
        content_version,observed_updated_at,content_pending,sparse)
       VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(word_id) DO UPDATE SET mode=excluded.mode,
        entry_id=excluded.entry_id, adopted_revision_id=excluded.adopted_revision_id,
        content_version=excluded.content_version, observed_updated_at=excluded.observed_updated_at,
        content_pending=excluded.content_pending, sparse=excluded.sparse WHERE user_id=excluded.user_id`,
      id,
      owner,
      mode,
      entry,
      adopted,
      version,
      row.updated_at,
      pending,
      complete ? 0 : sparse
    )
    const changed = !state || !matchesPersonalState(state, row)
    if (!cacheCurrent || (state && changed)) {
      await transaction.runAsync(
        `INSERT INTO dictionary_following_refresh_queue(word_id,user_id,refresh_version)
         VALUES (?,?,1) ON CONFLICT(word_id) DO UPDATE SET refresh_version = refresh_version + 1
         WHERE user_id = excluded.user_id AND (? = 1 OR refresh_version = completed_refresh_version)`,
        id,
        owner,
        Number(changed)
      )
    }
    return Boolean(baseline)
  }

  private personalReadiness(
    row: PersonalMetadataRow,
    cache: {
      mode: string
      entry_id: string | null
      adopted: string | null
      content_version: string
    } | null,
    state: PersonalState | null,
    exists: boolean
  ) {
    const mode = row.dictionary_content_mode
    const bindingMatches =
      cache?.mode === mode && cache.entry_id === row.dictionary_entry_id
    const cacheCurrent =
      bindingMatches &&
      cache.adopted === row.dictionary_revision_id &&
      cache.content_version === row.content_version
    return {
      bindingMatches,
      cacheCurrent,
      sparse: state?.sparse ?? Number(!exists && mode === 'follow'),
      pending: Number(
        mode === 'follow' ? !bindingMatches : cache?.mode === 'follow'
      ),
    }
  }

  private async requirePersonalCollection(
    transaction: SQLiteDatabase,
    collection: string | null,
    owner: string
  ): Promise<void> {
    if (!collection) return
    const found = await transaction.getFirstAsync(
      "SELECT collection_id FROM collections WHERE collection_id = ? AND user_id = ? AND sync_status <> 'deleted'",
      [collection, owner]
    )
    if (!found)
      throw new Error('Personal collection must be synchronized first')
  }

  private async applyPersonalFields(
    transaction: SQLiteDatabase,
    row: PersonalMetadataRow,
    match: ExistingWordCheck | null,
    knownFollowing: boolean
  ): Promise<void> {
    if (
      match &&
      !this.shouldPreserveExistingWord(match, { preserveUnsynced: true })
    )
      await transaction.runAsync(
        `UPDATE words SET collection_id=?, dutch_lemma=?, part_of_speech=?, article=?,
         updated_at=? WHERE word_id=? AND user_id=?`,
        row.collection_id,
        row.dutch_lemma,
        row.part_of_speech,
        row.article,
        row.updated_at,
        row.word_id,
        row.user_id
      )
    // A known following card has no unqueued lexical edit. Settle only a
    // review residue with the same personal placement/key and no other commands.
    if (knownFollowing && match?.sync_status === 'pending') {
      const acknowledged = await transaction.getFirstAsync(
        `${ACKNOWLEDGED_LEARNING_WORD_SQL} AND word_id = ? AND collection_id IS ?
          AND dutch_lemma = ? AND part_of_speech IS ? AND article IS ?`,
        [
          row.user_id,
          row.word_id,
          row.collection_id,
          row.dutch_lemma,
          row.part_of_speech,
          row.article,
        ]
      )
      if (acknowledged)
        await transaction.runAsync(
          "UPDATE words SET sync_status='synced', updated_at=?, synced_at=? WHERE word_id=? AND user_id=?",
          row.updated_at,
          new Date().toISOString(),
          row.word_id,
          row.user_id
        )
    }
    // Keep provisional study fields until ordered commands and correction recovery settle.
    await transaction.runAsync(
      `UPDATE words SET interval_days=?, repetition_count=?, easiness_factor=?, next_review_date=?, last_reviewed_at=?
       WHERE word_id=? AND user_id=? AND NOT EXISTS (
         SELECT 1 FROM learning_commands l WHERE l.word_id=words.word_id
       ) AND NOT EXISTS (
         SELECT 1 FROM review_correction_recovery r WHERE r.word_id=words.word_id
       ) AND NOT EXISTS (
         SELECT 1 FROM review_events e WHERE e.word_id=words.word_id AND e.sync_status <> 'synced'
       )`,
      row.interval_days,
      row.repetition_count,
      row.easiness_factor,
      row.next_review_date,
      row.last_reviewed_at,
      row.word_id,
      row.user_id
    )
  }

  async saveRemoteWordTombstones(words: RemoteWordTombstone[]): Promise<void> {
    if (words.length === 0) return

    const db = await getDatabase()
    const statement = await db.prepareAsync(UPSERT_WORD_TOMBSTONE_SQL)
    const syncedAt = new Date().toISOString()

    try {
      for (const word of words) {
        await statement.executeAsync(
          ...this.getInsertValues(word, word.deleted_at, 'synced', syncedAt)
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  }

  private async prepareSaveWordStatements(
    db: SQLiteDatabase
  ): Promise<SaveWordStatements> {
    const preparedStatements: SQLiteStatement[] = []

    try {
      const checkExisting = await db.prepareAsync(CHECK_EXISTING_WORD_SQL)
      preparedStatements.push(checkExisting)
      const update = await db.prepareAsync(UPDATE_WORD_SQL)
      preparedStatements.push(update)
      const insert = await db.prepareAsync(INSERT_WORD_SQL)
      preparedStatements.push(insert)

      return { checkExisting, update, insert }
    } catch (error) {
      await Promise.all(
        preparedStatements.map(statement => statement.finalizeAsync())
      )
      throw error
    }
  }

  private async finalizeSaveWordStatements(
    statements: SaveWordStatements
  ): Promise<void> {
    await Promise.all([
      statements.checkExisting.finalizeAsync(),
      statements.update.finalizeAsync(),
      statements.insert.finalizeAsync(),
    ])
  }

  private async persistWords(
    words: Word[],
    statements: SaveWordStatements,
    options: SaveWordsOptions
  ): Promise<MergedWord[]> {
    const mergedWords: MergedWord[] = []

    for (const word of words) {
      const mergedWord = await this.persistWord(word, statements, options)
      if (mergedWord) {
        mergedWords.push(mergedWord)
      }
    }

    return mergedWords
  }

  private async persistWord(
    word: Word,
    statements: SaveWordStatements,
    options: SaveWordsOptions
  ): Promise<MergedWord | null> {
    const syncedAt = options.syncedAt ?? new Date().toISOString()
    const existingWord = await this.findExistingWord(
      statements.checkExisting,
      word
    )

    if (!existingWord) {
      await statements.insert.executeAsync(
        ...this.getInsertValues(word, null, 'synced', syncedAt)
      )
      return null
    }

    if (this.shouldPreserveExistingWord(existingWord, options)) {
      return null
    }

    if (
      existingWord.word_id !== word.word_id &&
      existingWord.has_dictionary_content
    ) {
      throw new Error(
        'Personal word identity conflict. Local content and learning queues are preserved.'
      )
    }

    const result = await statements.update.executeAsync(
      ...this.getUpdateValues(word, existingWord.word_id, syncedAt),
      options.preserveUnsynced ? 1 : 0
    )
    if (result?.changes === 0) return null
    return {
      dutch_lemma: word.dutch_lemma,
      existing_id: existingWord.word_id,
      incoming_id: word.word_id,
    }
  }

  private async findExistingWord(
    statement: SQLiteStatement,
    word: Word
  ): Promise<ExistingWordCheck | null> {
    const normalizedPartOfSpeech = word.part_of_speech || 'unknown'
    const normalizedArticle = word.article?.trim() || ''
    const result = await statement.executeAsync<ExistingWordCheck>(
      word.user_id,
      word.word_id,
      word.dutch_lemma,
      normalizedPartOfSpeech,
      normalizedArticle,
      word.word_id
    )
    return result.getFirstAsync()
  }

  private shouldPreserveExistingWord(
    existingWord: ExistingWordCheck,
    options: SaveWordsOptions
  ): boolean {
    if (existingWord.deleted_at || existingWord.sync_status === 'deleted') {
      return true
    }

    return Boolean(
      options.preserveUnsynced &&
      (UNSYNCED_STATUSES.has(existingWord.sync_status) ||
        existingWord.has_pending_learning ||
        existingWord.has_pending_dictionary ||
        existingWord.has_pending_import)
    )
  }

  private getInsertValues(
    word: Word,
    deletedAt: string | null = null,
    syncStatus: SyncStatus = 'synced',
    syncedAt: string | null = null
  ): SQLiteBindValue[] {
    return [
      this.toSqlValue(word.word_id),
      this.toSqlValue(word.user_id),
      ...this.getMutableWordValues(word, deletedAt, syncStatus, syncedAt),
    ]
  }

  private getUpdateValues(
    word: Word,
    existingWordId: string,
    syncedAt: string
  ): SQLiteBindValue[] {
    return [
      this.toSqlValue(word.word_id),
      ...this.getMutableWordValues(word, null, 'synced', syncedAt),
      existingWordId,
      word.user_id,
    ]
  }

  private getMutableWordValues(
    word: Word,
    deletedAt: string | null = null,
    syncStatus: SyncStatus = 'synced',
    syncedAt: string | null = null
  ): SQLiteBindValue[] {
    return [
      ...this.getContentAndProgressValues(word),
      this.toSqlValue(word.created_at),
      this.toSqlValue(word.updated_at),
      deletedAt,
      syncStatus,
      null,
      syncedAt,
    ]
  }

  private getContentAndProgressValues(
    word: Word,
    serialize: (value: unknown) => string = JSON.stringify
  ): SQLiteBindValue[] {
    return [
      this.toNullableSqlValue(word.collection_id),
      this.toSqlValue(word.dutch_lemma),
      this.toNullableSqlValue(word.dutch_original),
      this.toNullableSqlValue(word.part_of_speech),
      word.is_irregular ? 1 : 0,
      word.is_reflexive ? 1 : 0,
      word.is_expression ? 1 : 0,
      this.toNullableSqlValue(word.expression_type),
      word.is_separable ? 1 : 0,
      this.toNullableSqlValue(word.prefix_part),
      this.toNullableSqlValue(word.root_verb),
      this.toNullableSqlValue(word.article),
      this.toNullableSqlValue(word.plural),
      this.toNullableSqlValue(word.register),
      serialize(this.toSqlValue(word.translations) || []),
      word.examples ? serialize(word.examples) : null,
      serialize(this.toSqlValue(word.synonyms) || []),
      serialize(this.toSqlValue(word.antonyms) || []),
      word.conjugation ? serialize(word.conjugation) : null,
      this.toNullableSqlValue(word.preposition),
      this.toNullableSqlValue(word.image_url),
      this.toNullableSqlValue(word.tts_url),
      Number(word.interval_days ?? 1),
      Number(word.repetition_count ?? 0),
      Number(word.easiness_factor ?? 2.5),
      this.toSqlValue(word.next_review_date),
      this.toNullableSqlValue(word.last_reviewed_at),
      this.toNullableSqlValue(word.analysis_notes),
      word.usage_notes ? serialize(word.usage_notes) : null,
    ]
  }

  private logMergedWords(mergedWords: MergedWord[]): void {
    if (mergedWords.length === 0) {
      return
    }

    const mergedCount = mergedWords.length
    console.log(
      `[WordRepository] Merged ${mergedCount} words with existing semantic keys`
    )
    Sentry.addBreadcrumb({
      category: 'db.saveWords',
      message: `Merged ${mergedCount} words with existing semantic keys`,
      level: 'info',
      data: {
        mergedCount,
        mergedWords: mergedWords.slice(0, 10),
      },
    })
  }

  private async parseReadableWords(
    rows: Record<string, unknown>[]
  ): Promise<LocalWord[]> {
    const words = rows.map(row => this.parseWordRow(row))
    const sparse = words.filter((_, index) => rows[index].personal_sparse === 1)
    if (!sparse.length) return words
    const cache = await dictionaryFollowingRepository.getCachedCards(
      sparse[0].user_id,
      sparse.map(word => word.word_id)
    )
    return words.flatMap((word, index) => {
      if (rows[index].personal_sparse !== 1) return [word]
      const item = cache.get(word.word_id)
      if (!item || item.card.word_id !== word.word_id) return []
      return [
        {
          ...word,
          ...applyDictionaryMaterialization(word, {
            ...item,
            dependency_status: 'ready',
            has_conflict: false,
          }),
        },
      ]
    })
  }

  async getWordsByUserId(userId: string): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${READABLE_WORD_COLUMNS} FROM words WHERE user_id = ? AND deleted_at IS NULL AND ${WORD_CONTENT_READY} ORDER BY created_at DESC`,
      [userId]
    )

    return this.parseReadableWords(result)
  }

  async getWordByIdAndUserId(
    wordId: string,
    userId: string
  ): Promise<LocalWord | null> {
    const db = await getDatabase()

    const result = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT ${READABLE_WORD_COLUMNS} FROM words WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL AND ${WORD_CONTENT_READY}`,
      [wordId, userId]
    )

    return result
      ? ((await this.parseReadableWords([result]))[0] ?? null)
      : null
  }

  async getWordBySemanticKey(
    userId: string,
    dutchLemma: string,
    partOfSpeech?: string,
    article?: string
  ): Promise<LocalWord | null> {
    const db = await getDatabase()
    const normalizedLemma = dutchLemma.trim().toLowerCase()
    const normalizedPartOfSpeech = partOfSpeech || 'unknown'
    const normalizedArticle =
      article && article.trim() !== '' ? article.trim() : ''

    const result = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT ${READABLE_WORD_COLUMNS} FROM words
       WHERE user_id = ?
         AND ${WORD_CONTENT_READY}
         AND deleted_at IS NULL
         AND lower(dutch_lemma) = ?
         AND COALESCE(part_of_speech, 'unknown') = ?
         AND COALESCE(article, '') = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, normalizedLemma, normalizedPartOfSpeech, normalizedArticle]
    )

    return result
      ? ((await this.parseReadableWords([result]))[0] ?? null)
      : null
  }

  async getWordsByCollectionId(collectionId: string): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${READABLE_WORD_COLUMNS} FROM words WHERE collection_id = ? AND deleted_at IS NULL AND ${WORD_CONTENT_READY} ORDER BY created_at DESC`,
      [collectionId]
    )

    return this.parseReadableWords(result)
  }

  async updateWordProgress(
    wordId: string,
    userId: string,
    progress: Partial<Word>
  ): Promise<void> {
    const db = await getDatabase()

    const fields: string[] = []
    const values: SQLiteBindValue[] = []

    if ('interval_days' in progress) {
      fields.push('interval_days = ?')
      values.push(progress.interval_days ?? null)
    }
    if ('repetition_count' in progress) {
      fields.push('repetition_count = ?')
      values.push(progress.repetition_count ?? null)
    }
    if ('easiness_factor' in progress) {
      fields.push('easiness_factor = ?')
      values.push(progress.easiness_factor ?? null)
    }
    if ('next_review_date' in progress) {
      fields.push('next_review_date = ?')
      values.push(progress.next_review_date ?? null)
    }
    if ('last_reviewed_at' in progress) {
      fields.push('last_reviewed_at = ?')
      values.push(progress.last_reviewed_at ?? null)
    }

    if (fields.length === 0) {
      return
    }

    fields.push('updated_at = ?')
    values.push(new Date().toISOString())
    fields.push('sync_status = ?')
    values.push('pending')
    values.push(wordId)
    values.push(userId)

    const updateStatement = await db.prepareAsync(
      `UPDATE words SET ${fields.join(', ')} WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`
    )

    try {
      await updateStatement.executeAsync(...values)
    } finally {
      await updateStatement.finalizeAsync()
    }
  }

  async getUpdatedSince(
    timestamp: string,
    userId: string
  ): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${READABLE_WORD_COLUMNS} FROM words WHERE user_id = ? AND updated_at > ? AND ${WORD_CONTENT_READY} ORDER BY updated_at DESC`,
      [userId, timestamp]
    )

    return this.parseReadableWords(result)
  }

  async hasSparsePersonalRows(
    userId: string,
    ids: readonly string[]
  ): Promise<boolean> {
    const db = await getDatabase()
    for (let start = 0; start < ids.length; start += 400) {
      const chunk = ids.slice(start, start + 400)
      const row = await db.getFirstAsync(
        `SELECT word_id FROM dictionary_personal_state WHERE user_id=? AND sparse=1
         AND word_id IN (${chunk.map(() => '?').join(',')}) LIMIT 1`,
        [userId, ...chunk]
      )
      if (row) return true
    }
    return false
  }

  async getPendingSyncWords(userId: string): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      isDictionaryContentEnabled()
        ? `SELECT * FROM words WHERE user_id = ? AND deleted_at IS NULL AND ${WORD_CONTENT_READY} AND (sync_status = 'pending'
           OR EXISTS (SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id
             AND d.user_id = words.user_id AND d.local_placement_revision > d.acknowledged_placement_revision))
           ORDER BY updated_at ASC`
        : `SELECT * FROM words WHERE user_id = ? AND sync_status = 'pending' AND deleted_at IS NULL AND ${WORD_CONTENT_READY} AND NOT EXISTS (SELECT 1 FROM dictionary_personal_state s WHERE s.word_id=words.word_id AND s.sparse=1) ORDER BY updated_at ASC`,
      [userId]
    )

    return result.map(row => this.parseWordRow(row))
  }

  async markWordsSynced(wordVersions: WordSyncVersion[]): Promise<void> {
    if (wordVersions.length === 0) return

    const db = await getDatabase()
    const statement = await db.prepareAsync(
      `UPDATE words
       SET sync_status = 'synced', last_sync_attempt_at = ?, synced_at = ?
       WHERE word_id = ? AND updated_at = ?`
    )
    const syncedAt = new Date().toISOString()

    try {
      for (const wordVersion of wordVersions) {
        await statement.executeAsync(
          syncedAt,
          syncedAt,
          wordVersion.word_id,
          wordVersion.updated_at
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  }

  async reconcilePushedWords(
    acknowledgements: WordSyncAcknowledgement[],
    expectedUpdatedAtById: ReadonlyMap<string, string>
  ): Promise<void> {
    if (acknowledgements.length === 0) return

    const expectedTimestamps = acknowledgements.map(acknowledgement => {
      const expectedUpdatedAt = expectedUpdatedAtById.get(
        acknowledgement.word_id
      )
      if (!expectedUpdatedAt) {
        throw new Error(
          `Missing local word timestamp for ${acknowledgement.word_id}`
        )
      }
      return expectedUpdatedAt
    })
    const db = await getDatabase()
    const statement = await db.prepareAsync(
      `UPDATE words
       SET sync_status = 'synced',
           updated_at = ?,
           deleted_at = ?,
           last_sync_attempt_at = ?,
           synced_at = ?
       WHERE word_id = ?
         AND updated_at = ?
         AND sync_status IN ('pending', 'deleted')`
    )
    const syncedAt = new Date().toISOString()

    try {
      for (const [index, acknowledgement] of acknowledgements.entries()) {
        await statement.executeAsync(
          acknowledgement.updated_at,
          acknowledgement.deleted_at,
          syncedAt,
          syncedAt,
          acknowledgement.word_id,
          expectedTimestamps[index]
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  }

  async markWordsError(wordVersions: WordSyncVersion[]): Promise<void> {
    if (wordVersions.length === 0) return

    const db = await getDatabase()
    const statement = await db.prepareAsync(
      `UPDATE words
       SET sync_status = 'error', last_sync_attempt_at = ?
       WHERE word_id = ? AND updated_at = ?`
    )
    const attemptedAt = new Date().toISOString()

    try {
      for (const wordVersion of wordVersions) {
        await statement.executeAsync(
          attemptedAt,
          wordVersion.word_id,
          wordVersion.updated_at
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  }

  async deleteWord(
    wordId: string,
    userId: string,
    assertOwner: () => void = () => {}
  ): Promise<void> {
    const db = await getDatabase()
    if (isDictionaryContentEnabled()) {
      await db.withExclusiveTransactionAsync(async transaction => {
        assertOwner()
        await queueImportDeletion(transaction, userId, wordId)
        const now = new Date().toISOString()
        await transaction.runAsync(
          `UPDATE words SET deleted_at = ?,updated_at = ?,sync_status = 'deleted'
          WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`,
          now,
          now,
          wordId,
          userId
        )
        assertOwner()
      })
      return
    }
    const statement = await db.prepareAsync(
      `UPDATE words
       SET deleted_at = ?, updated_at = ?, sync_status = 'deleted'
       WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`
    )

    try {
      const deletedAt = new Date().toISOString()
      await statement.executeAsync(deletedAt, deletedAt, wordId, userId)
    } finally {
      await statement.finalizeAsync()
    }
  }

  async deleteWordsByCollection(
    collectionId: string,
    userId: string,
    options: { preservePendingImports?: boolean } = {}
  ): Promise<void> {
    const db = await getDatabase()
    if (isDictionaryContentEnabled() && !options.preservePendingImports) {
      await db.withExclusiveTransactionAsync(async transaction => {
        const words = await transaction.getAllAsync<{ word_id: string }>(
          'SELECT word_id FROM words WHERE collection_id = ? AND user_id = ? AND deleted_at IS NULL',
          [collectionId, userId]
        )
        for (const word of words)
          await queueImportDeletion(transaction, userId, word.word_id)
        const now = new Date().toISOString()
        await transaction.runAsync(
          `UPDATE words SET deleted_at = ?,updated_at = ?,sync_status = 'deleted'
          WHERE collection_id = ? AND user_id = ? AND deleted_at IS NULL`,
          now,
          now,
          collectionId,
          userId
        )
      })
      return
    }
    const statement = await db.prepareAsync(
      `UPDATE words
       SET deleted_at = ?, updated_at = ?, sync_status = 'deleted'
       WHERE collection_id = ? AND user_id = ? AND deleted_at IS NULL
         AND (? = 0 OR NOT EXISTS (
           SELECT 1 FROM dictionary_import_intents imports
           WHERE imports.word_id = words.word_id AND imports.user_id = words.user_id
         ) AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = words.word_id)
         AND NOT EXISTS (SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id))`
    )

    try {
      const deletedAt = new Date().toISOString()
      await statement.executeAsync(
        deletedAt,
        deletedAt,
        collectionId,
        userId,
        options.preservePendingImports ? 1 : 0
      )
    } finally {
      await statement.finalizeAsync()
    }
  }

  async getDeletedWords(userId: string): Promise<LocalWord[]> {
    const db = await getDatabase()
    const result = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM words WHERE user_id = ? AND sync_status = 'deleted' AND deleted_at IS NOT NULL ORDER BY updated_at ASC",
      [userId]
    )

    return result.map(row => this.parseWordRow(row))
  }

  async markWordTombstonesSynced(wordIds: string[]): Promise<void> {
    if (wordIds.length === 0) return

    const db = await getDatabase()
    const placeholders = wordIds.map(() => '?').join(',')
    const statement = await db.prepareAsync(
      `UPDATE words
       SET sync_status = 'synced', last_sync_attempt_at = ?, synced_at = ?
       WHERE word_id IN (${placeholders}) AND deleted_at IS NOT NULL`
    )

    try {
      const syncedAt = new Date().toISOString()
      await statement.executeAsync(syncedAt, syncedAt, ...wordIds)
    } finally {
      await statement.finalizeAsync()
    }
  }

  async deleteInvalidWords(
    userId: string
  ): Promise<{ count: number; words: { dutch_lemma: string }[] }> {
    const db = await getDatabase()

    // First, get the invalid words to log them
    const selectStatement = await db.prepareAsync(
      'SELECT dutch_lemma, dutch_original FROM words WHERE word_id IS NULL AND user_id = ?'
    )

    let invalidWords: { dutch_lemma: string }[] = []

    try {
      const result = await selectStatement.executeAsync<{
        dutch_lemma: string
        dutch_original: string | null
      }>(userId)
      invalidWords = await result.getAllAsync()
    } finally {
      await selectStatement.finalizeAsync()
    }

    // Then delete them
    const deleteStatement = await db.prepareAsync(
      'DELETE FROM words WHERE word_id IS NULL AND user_id = ?'
    )

    try {
      const result = await deleteStatement.executeAsync(userId)
      const deletedCount = result.changes
      return { count: deletedCount, words: invalidWords }
    } finally {
      await deleteStatement.finalizeAsync()
    }
  }

  async deleteOrphanWords(userId: string): Promise<{ count: number }> {
    const db = await getDatabase()

    const statement = await db.prepareAsync(
      `UPDATE words
       SET deleted_at = ?, updated_at = ?, sync_status = 'deleted'
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM dictionary_import_intents imports
           WHERE imports.word_id = words.word_id AND imports.user_id = words.user_id
         )
      AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = words.word_id)
      AND NOT EXISTS (SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id)
         AND (
           collection_id IS NULL
           OR collection_id NOT IN (
             SELECT collection_id FROM collections WHERE user_id = ?
           )
         )`
    )

    try {
      const deletedAt = new Date().toISOString()
      const result = await statement.executeAsync(
        deletedAt,
        deletedAt,
        userId,
        userId
      )
      return { count: result.changes }
    } finally {
      await statement.finalizeAsync()
    }
  }

  async addWord(word: Word): Promise<void> {
    await this.addWords([word])
  }

  /** Copy document content atomically without moving or changing existing cards. */
  async importPrivateCopies(
    words: Word[],
    userId: string,
    collectionId: string,
    assertOwner: () => void
  ): Promise<Word[]> {
    if (!isDictionaryContentEnabled())
      throw new Error('Dictionary transfer is unavailable.')
    for (const word of words) {
      this.validateWordId(word)
      if (word.user_id !== userId || word.collection_id !== collectionId)
        throw new Error('Invalid dictionary import owner or target.')
    }
    const db = await getDatabase()
    const inserted: Word[] = []
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const target = await transaction.getFirstAsync<{ collection_id: string }>(
        `SELECT collection_id FROM collections WHERE collection_id = ? AND user_id = ?
          AND COALESCE(sync_status, 'synced') <> 'deleted'`,
        [collectionId, userId]
      )
      if (!target) throw new Error('Collection not found or access denied.')
      for (const word of words) {
        const duplicate = await transaction.getFirstAsync<{ word_id: string }>(
          `SELECT word_id FROM words WHERE user_id = ? AND deleted_at IS NULL
            AND LOWER(dutch_lemma) = LOWER(?)
            AND COALESCE(part_of_speech, 'unknown') = ? AND COALESCE(article, '') = ?`,
          [
            userId,
            word.dutch_lemma,
            word.part_of_speech ?? 'unknown',
            word.article ?? '',
          ]
        )
        if (duplicate) continue
        await transaction.runAsync(
          INSERT_WORD_SQL,
          ...this.getInsertValues(word, null, 'pending', null)
        )
        await this.initializePrivateDictionaryContent(transaction, word)
        await this.initializeDictionaryImport(transaction, word, {
          kind: 'private-copy',
          content: wordToDictionaryContent(word),
        })
        inserted.push(word)
      }
      assertOwner()
    })
    return inserted
  }

  async addWords(
    words: Word[],
    references?: readonly (DictionaryReference | null)[],
    importSources?: readonly DictionaryImportSource[]
  ): Promise<void> {
    if (words.length === 0) return
    if (
      references &&
      (references.length !== words.length ||
        !isDictionaryContentEnabled() ||
        references.some(
          reference =>
            reference !== null && !parseDictionaryReference(reference).success
        ))
    ) {
      throw new Error('Invalid official import references')
    }

    for (const word of words) {
      this.validateWordId(word)
    }
    if (
      importSources &&
      (importSources.length !== words.length || !isDictionaryContentEnabled())
    ) {
      throw new Error('Invalid dictionary import sources')
    }

    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const [index, word] of words.entries()) {
        await transaction.runAsync(
          INSERT_WORD_SQL,
          ...this.getInsertValues(word, null, 'pending', null)
        )
        if (isDictionaryContentEnabled()) {
          await this.initializePrivateDictionaryContent(transaction, word)
          const reference = references?.[index]
          if (reference)
            await this.initializeOfficialDictionaryReference(
              transaction,
              word,
              reference
            )
          const source = importSources?.[index]
          if (source)
            await this.initializeDictionaryImport(
              transaction,
              word,
              source,
              reference
            )
        }
      }
    })
  }

  private async initializeDictionaryImport(
    transaction: SQLiteDatabase,
    word: Word,
    source: DictionaryImportSource,
    reference?: DictionaryReference | null
  ): Promise<void> {
    const expectedReference =
      source.kind === 'official-pack' ? source.reference : null
    if (
      JSON.stringify(source.content) !==
        JSON.stringify(wordToDictionaryContent(word)) ||
      JSON.stringify(expectedReference) !== JSON.stringify(reference ?? null)
    ) {
      throw new Error('Dictionary import source does not match local content')
    }
    if (!word.collection_id)
      throw new Error('Dictionary import target is missing')
    await dictionaryImportRepository.enqueue(
      transaction,
      word.user_id,
      {
        protocol_version: 1,
        operation_id: randomUUID(),
        word_id: word.word_id,
        collection_id: word.collection_id,
        source,
      },
      word.created_at
    )
  }

  private async initializeOfficialDictionaryReference(
    transaction: SQLiteDatabase,
    word: Word,
    reference: DictionaryReference
  ): Promise<void> {
    const cached = await transaction.getFirstAsync<{ content_json: string }>(
      `SELECT content_json FROM dictionary_revision_cache WHERE entry_id = ? AND revision_id = ?`,
      [reference.entry_id, reference.revision_id]
    )
    if (!cached) throw new Error('Official import dependency is missing')
    const content = parseDictionaryContent(
      JSON.parse(cached.content_json) as unknown
    )
    if (
      !content.success ||
      JSON.stringify(content.data) !==
        JSON.stringify(wordToDictionaryContent(word))
    ) {
      throw new Error('Official import dependency is invalid')
    }
    const command: DictionaryContentCommand = {
      protocol_version: DICTIONARY_CONTENT_PROTOCOL_VERSION,
      operation_id: randomUUID(),
      word_id: word.word_id,
      expected_content_version: 1,
      kind: 'link',
      reference,
      overrides: {},
    }
    // The verified immutable dependency must already be cached for offline use.
    await transaction.runAsync(
      `UPDATE dictionary_card_content
      SET content_version = 2, entry_id = ?, revision_id = ?, fallback_content_json = NULL
      WHERE word_id = ? AND user_id = ?`,
      reference.entry_id,
      reference.revision_id,
      word.word_id,
      word.user_id
    )
    await transaction.runAsync(
      `INSERT INTO dictionary_content_commands(
      operation_id, user_id, word_id, kind, expected_content_version, payload_json, queued_at
    ) VALUES (?, ?, ?, 'link', 1, ?, ?)`,
      command.operation_id,
      word.user_id,
      word.word_id,
      JSON.stringify(command),
      word.updated_at
    )
  }

  private async initializePrivateDictionaryContent(
    transaction: SQLiteDatabase,
    word: Word
  ): Promise<void> {
    const content = wordToDictionaryContent(word)
    const command: DictionaryContentCommand = {
      protocol_version: DICTIONARY_CONTENT_PROTOCOL_VERSION,
      operation_id: randomUUID(),
      word_id: word.word_id,
      expected_content_version: 0,
      kind: 'create-private',
      content,
    }
    await transaction.runAsync(
      `INSERT INTO dictionary_card_content(
        word_id, user_id, content_version, entry_id, revision_id,
        fallback_content_json, overrides_json, updated_at
      ) VALUES (?, ?, 1, NULL, NULL, ?, '{}', ?)`,
      word.word_id,
      word.user_id,
      JSON.stringify(content),
      word.updated_at
    )
    await transaction.runAsync(
      `INSERT INTO dictionary_content_commands(
        operation_id, user_id, word_id, kind, expected_content_version,
        payload_json, queued_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
      command.operation_id,
      word.user_id,
      word.word_id,
      command.kind,
      JSON.stringify(command),
      word.updated_at
    )
  }

  async preserveLegacyPendingContent(userId: string): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      const rows = await transaction.getAllAsync<Record<string, unknown>>(
        `SELECT words.* FROM words
         LEFT JOIN dictionary_card_content cards ON cards.word_id = words.word_id
         WHERE words.user_id = ? AND words.deleted_at IS NULL
           AND words.sync_status = 'pending' AND cards.word_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM dictionary_personal_state s WHERE s.word_id=words.word_id AND (s.sparse=1 OR s.mode='follow'))
           AND NOT EXISTS (
             SELECT 1 FROM dictionary_effective_card_cache effective
             WHERE effective.word_id = words.word_id
               AND effective.user_id = words.user_id
           )`,
        [userId]
      )
      for (const row of rows) {
        await this.initializePrivateDictionaryContent(
          transaction,
          this.parseWordRow(row)
        )
      }
    })
  }

  private validateWordId(word: Word): void {
    if (!word.word_id) {
      console.error(
        '[WordRepository] ERROR: Attempting to add word with null/undefined word_id:',
        {
          dutch_lemma: word.dutch_lemma,
          user_id: word.user_id,
          word_object: word,
        }
      )
      throw new Error(`Cannot add word with null word_id: ${word.dutch_lemma}`)
    }
  }

  async updateAnalyzedWord(word: Word): Promise<Word> {
    const db = await getDatabase()

    try {
      await this.runAnalyzedWordUpdate(db, word)
      return word
    } catch (error) {
      if (!this.isSemanticKeyConstraintError(error)) {
        throw error
      }

      const currentWord = await this.getWordByIdAndUserId(
        word.word_id,
        word.user_id
      )
      if (!currentWord) {
        throw error
      }

      const conflictSafeWord: Word = {
        ...word,
        dutch_lemma: currentWord.dutch_lemma,
        part_of_speech: currentWord.part_of_speech,
        article: currentWord.article,
      }

      await this.runAnalyzedWordUpdate(db, conflictSafeWord)
      Sentry.addBreadcrumb({
        category: 'db.updateAnalyzedWord',
        message: 'Preserved semantic key after re-analysis conflict',
        level: 'warning',
        data: { wordId: word.word_id },
      })

      return conflictSafeWord
    }
  }

  async assertPrivateContentEditable(
    userId: string,
    wordId: string
  ): Promise<void> {
    await this.requirePrivateContentEditable(
      await getDatabase(),
      userId,
      wordId
    )
  }

  private async requirePrivateContentEditable(
    db: SQLiteDatabase,
    userId: string,
    wordId: string
  ): Promise<void> {
    const cached = await db.getFirstAsync<{
      mode: string
      content_version: string
    }>(
      'SELECT mode, content_version FROM dictionary_effective_card_cache WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    )
    if (cached?.mode === 'follow')
      throw new Error(
        'This word uses shared dictionary content. Shared analysis is required.'
      )
    if (!isDictionaryFollowingEnabled()) {
      if (cached?.mode !== 'legacy') return
      const reviewed = await db.getFirstAsync<{ operation_id: string }>(
        'SELECT operation_id FROM dictionary_mode_reconciliations WHERE user_id = ? AND word_id = ? LIMIT 1',
        [userId, wordId]
      )
      if (!reviewed) return
    }

    const legacy = await db.getFirstAsync<{ content_version: number }>(
      'SELECT content_version FROM dictionary_card_content WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    )
    if (
      !cached ||
      cached.content_version !== String(legacy?.content_version ?? 0)
    )
      throw new Error(
        'Sync or resolve dictionary content before changing this word.'
      )
  }

  private async runAnalyzedWordUpdate(
    db: SQLiteDatabase,
    word: Word
  ): Promise<void> {
    await db.withExclusiveTransactionAsync(async transaction => {
      await this.requirePrivateContentEditable(
        transaction,
        word.user_id,
        word.word_id
      )
      const result = await transaction.runAsync(
        UPDATE_ANALYZED_WORD_SQL,
        ...this.getAnalyzedWordUpdateValues(word)
      )

      if (result.changes === 0) {
        throw new Error(`Cannot update missing word: ${word.word_id}`)
      }
      if (isDictionaryContentEnabled()) {
        await this.queueDictionaryContentReplacement(transaction, word)
      }
    })
  }

  private async queueDictionaryContentReplacement(
    transaction: SQLiteDatabase,
    word: Word
  ): Promise<void> {
    const current = await transaction.getFirstAsync<DictionaryCardVersion>(
      `SELECT content_version FROM dictionary_card_content
       WHERE word_id = ? AND user_id = ?`,
      [word.word_id, word.user_id]
    )
    const expectedVersion = current?.content_version ?? 0
    const content = wordToDictionaryContent(word)
    const command: DictionaryContentCommand = {
      protocol_version: DICTIONARY_CONTENT_PROTOCOL_VERSION,
      operation_id: randomUUID(),
      word_id: word.word_id,
      expected_content_version: expectedVersion,
      kind: current === null ? 'create-private' : 'resolve-conflict',
      content,
    }
    await transaction.runAsync(
      `INSERT INTO dictionary_card_content(
        word_id, user_id, content_version, entry_id, revision_id,
        fallback_content_json, overrides_json, updated_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, '{}', ?)
      ON CONFLICT(word_id) DO UPDATE SET
        content_version = excluded.content_version,
        entry_id = NULL,
        revision_id = NULL,
        fallback_content_json = excluded.fallback_content_json,
        overrides_json = '{}',
        updated_at = excluded.updated_at`,
      word.word_id,
      word.user_id,
      expectedVersion + 1,
      JSON.stringify(content),
      word.updated_at
    )
    await this.insertDictionaryCommand(transaction, word.user_id, command)
  }

  private async insertDictionaryCommand(
    transaction: SQLiteDatabase,
    userId: string,
    command: DictionaryContentCommand
  ): Promise<void> {
    await transaction.runAsync(
      `INSERT INTO dictionary_content_commands(
        operation_id, user_id, word_id, kind, expected_content_version,
        payload_json, queued_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      command.operation_id,
      userId,
      command.word_id,
      command.kind,
      command.expected_content_version,
      JSON.stringify(command),
      new Date().toISOString()
    )
  }

  private getAnalyzedWordUpdateValues(word: Word): SQLiteBindValue[] {
    return [
      word.dutch_lemma,
      this.toNullableSqlValue(word.dutch_original),
      this.toNullableSqlValue(word.part_of_speech),
      word.is_irregular ? 1 : 0,
      word.is_reflexive ? 1 : 0,
      word.is_expression ? 1 : 0,
      this.toNullableSqlValue(word.expression_type),
      word.is_separable ? 1 : 0,
      this.toNullableSqlValue(word.prefix_part),
      this.toNullableSqlValue(word.root_verb),
      this.toNullableSqlValue(word.article),
      this.toNullableSqlValue(word.plural),
      this.toNullableSqlValue(word.register),
      JSON.stringify(word.translations),
      word.examples ? JSON.stringify(word.examples) : null,
      JSON.stringify(word.synonyms || []),
      JSON.stringify(word.antonyms || []),
      word.conjugation ? JSON.stringify(word.conjugation) : null,
      this.toNullableSqlValue(word.preposition),
      this.toNullableSqlValue(word.image_url),
      this.toNullableSqlValue(word.tts_url),
      this.toNullableSqlValue(word.analysis_notes),
      word.usage_notes ? JSON.stringify(word.usage_notes) : null,
      word.updated_at,
      word.word_id,
      word.user_id,
    ]
  }

  private isSemanticKeyConstraintError(error: unknown): boolean {
    return (
      error instanceof Error && error.message.includes('idx_words_semantic_key')
    )
  }

  async updateWordImage(
    wordId: string,
    userId: string,
    imageUrl: string
  ): Promise<void> {
    const db = await getDatabase()
    const updatedAt = new Date().toISOString()
    await db.withExclusiveTransactionAsync(async transaction => {
      await this.requirePrivateContentEditable(transaction, userId, wordId)
      const result = await transaction.runAsync(
        `UPDATE words
         SET image_url = ?, updated_at = ?, sync_status = 'pending',
             last_sync_attempt_at = NULL, synced_at = NULL
         WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`,
        imageUrl,
        updatedAt,
        wordId,
        userId
      )
      if (result.changes !== 1) {
        throw new Error(`Cannot update missing word: ${wordId}`)
      }
      if (!isDictionaryContentEnabled()) return
      const card = await transaction.getFirstAsync<DictionaryCardEditState>(
        `SELECT content_version, overrides_json
         FROM dictionary_card_content
         WHERE word_id = ? AND user_id = ?`,
        [wordId, userId]
      )
      if (card === null) {
        const row = await transaction.getFirstAsync<Record<string, unknown>>(
          `SELECT * FROM words WHERE word_id = ? AND user_id = ?`,
          [wordId, userId]
        )
        if (row === null)
          throw new Error(`Cannot update missing word: ${wordId}`)
        await this.queueDictionaryContentReplacement(
          transaction,
          this.parseWordRow(row)
        )
        return
      }
      const parsedOverrides = JSON.parse(card.overrides_json) as unknown
      if (
        parsedOverrides === null ||
        typeof parsedOverrides !== 'object' ||
        Array.isArray(parsedOverrides)
      ) {
        throw new Error('Invalid local dictionary overrides')
      }
      const overrides = {
        ...(parsedOverrides as Record<string, unknown>),
        image_url: { op: 'set' as const, value: imageUrl },
      }
      const command: DictionaryContentCommand = {
        protocol_version: DICTIONARY_CONTENT_PROTOCOL_VERSION,
        operation_id: randomUUID(),
        word_id: wordId,
        expected_content_version: card.content_version,
        kind: 'edit-private',
        // edit-private replaces the complete override map on linked cards.
        overrides: requireDictionaryOverrides(overrides),
      }
      await transaction.runAsync(
        `UPDATE dictionary_card_content
         SET content_version = ?, overrides_json = ?, updated_at = ?
         WHERE word_id = ? AND user_id = ?`,
        card.content_version + 1,
        JSON.stringify(overrides),
        updatedAt,
        wordId,
        userId
      )
      await this.insertDictionaryCommand(transaction, userId, command)
    })
  }

  async moveWordToCollection(
    wordId: string,
    userId: string,
    newCollectionId: string,
    assertOwner: () => void = () => {}
  ): Promise<void> {
    const db = await getDatabase()

    if (isDictionaryContentEnabled()) {
      await db.withExclusiveTransactionAsync(async transaction => {
        assertOwner()
        const active = await transaction.getFirstAsync<{
          collection_id: string | null
        }>(
          'SELECT collection_id FROM words WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL',
          [wordId, userId]
        )
        const target = await transaction.getFirstAsync<{
          collection_id: string
        }>(
          `SELECT collection_id FROM collections WHERE collection_id = ? AND user_id = ? AND sync_status <> 'deleted'`,
          [newCollectionId, userId]
        )
        if (!active || !target)
          throw new Error('Owned card or target is unavailable')
        await recordExplicitImportMove(
          transaction,
          userId,
          wordId,
          active.collection_id,
          newCollectionId,
          randomUUID()
        )
        await transaction.runAsync(
          `UPDATE words SET collection_id = ?,updated_at = ?,sync_status = 'pending'
          WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`,
          newCollectionId,
          new Date().toISOString(),
          wordId,
          userId
        )
        assertOwner()
      })
      return
    }
    const updateStatement = await db.prepareAsync(
      'UPDATE words SET collection_id = ?, updated_at = ?, sync_status = ? WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL'
    )

    try {
      await updateStatement.executeAsync(
        newCollectionId,
        new Date().toISOString(),
        'pending',
        wordId,
        userId
      )
    } finally {
      await updateStatement.finalizeAsync()
    }
  }

  async resetWordProgress(wordId: string, userId: string): Promise<void> {
    const db = await getDatabase()
    const now = new Date()
    const resetId = randomUUID()
    await db.withExclusiveTransactionAsync(async transaction => {
      const result = await transaction.runAsync(
        `UPDATE words SET interval_days = 1, repetition_count = 0,
         easiness_factor = 2.5, next_review_date = ?, last_reviewed_at = NULL,
         updated_at = ?, sync_status = 'pending'
         WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL AND ${WORD_CONTENT_READY}`,
        toLocalDateKey(addLocalCalendarDays(now, 1)),
        now.toISOString(),
        wordId,
        userId
      )
      if (result.changes !== 1) throw new Error('Reset word was not found')
      await transaction.runAsync(
        `INSERT INTO learning_commands(operation_id, kind, user_id, word_id, reset_at, review_date)
         VALUES (?, 'reset', ?, ?, ?, ?)`,
        resetId,
        userId,
        wordId,
        now.toISOString(),
        toLocalDateKey(now)
      )
    })
  }

  private parseWordRow(row: Record<string, unknown>): LocalWord {
    return {
      word_id: row.word_id as string,
      user_id: row.user_id as string,
      collection_id: (row.collection_id as string) || null,
      dutch_lemma: row.dutch_lemma as string,
      dutch_original: (row.dutch_original as string) || null,
      part_of_speech: (row.part_of_speech as string) || null,
      is_irregular: Boolean(row.is_irregular),
      is_reflexive: Boolean(row.is_reflexive),
      is_expression: Boolean(row.is_expression),
      expression_type: (row.expression_type as Word['expression_type']) ?? null,
      is_separable: Boolean(row.is_separable),
      prefix_part: (row.prefix_part as string) || null,
      root_verb: (row.root_verb as string) || null,
      article: (row.article as 'de' | 'het') || null,
      plural: (row.plural as string) || null,
      register: (row.register as Word['register']) || null,
      translations: JSON.parse(row.translations as string),
      examples: row.examples ? JSON.parse(row.examples as string) : null,
      synonyms: JSON.parse((row.synonyms as string) || '[]'),
      antonyms: JSON.parse((row.antonyms as string) || '[]'),
      conjugation: row.conjugation
        ? JSON.parse(row.conjugation as string)
        : null,
      preposition: (row.preposition as string) || null,
      image_url: (row.image_url as string) || null,
      tts_url: (row.tts_url as string) || null,
      interval_days: row.interval_days as number,
      repetition_count: row.repetition_count as number,
      easiness_factor: row.easiness_factor as number,
      next_review_date: row.next_review_date as string,
      last_reviewed_at: (row.last_reviewed_at as string) || null,
      analysis_notes: (row.analysis_notes as string) || null,
      usage_notes: row.usage_notes
        ? JSON.parse(row.usage_notes as string)
        : null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: (row.deleted_at as string) || null,
      sync_status: (row.sync_status as SyncStatus) || 'synced',
      last_sync_attempt_at: (row.last_sync_attempt_at as string) || null,
      synced_at: (row.synced_at as string) || null,
    }
  }
}

export const wordRepository = new WordRepository()
