import { getDatabase } from './initDB'
import type {
  SQLiteBindValue,
  SQLiteDatabase,
  SQLiteStatement,
} from 'expo-sqlite'
import { Word } from '@/types/database'
import type { SyncStatus } from './schema'
import { Sentry } from '@/lib/sentry'

export interface LocalWord extends Word {
  sync_status: SyncStatus
  deleted_at: string | null
}

// Type for existing word check result
interface ExistingWordCheck {
  word_id: string
  sync_status: SyncStatus
  updated_at: string
  deleted_at: string | null
}

interface SaveWordsOptions {
  preserveUnsynced?: boolean
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

export interface RemoteWordTombstone extends Word {
  deleted_at: string
}

const UNSYNCED_STATUSES = new Set<SyncStatus>([
  'pending',
  'error',
  'conflict',
  'deleted',
])

const CHECK_EXISTING_WORD_SQL = `
  SELECT word_id, sync_status, updated_at, deleted_at
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
    created_at = ?,
    updated_at = ?,
    deleted_at = ?,
    sync_status = ?
  WHERE word_id = ? AND user_id = ?
`

const INSERT_WORD_SQL = `
  INSERT INTO words (
    word_id, user_id, collection_id, dutch_lemma, dutch_original,
    part_of_speech, is_irregular, is_reflexive, is_expression,
    expression_type, is_separable, prefix_part, root_verb, article,
    plural, register, translations, examples, synonyms, antonyms, conjugation,
    preposition, image_url, tts_url, interval_days, repetition_count,
    easiness_factor, next_review_date, last_reviewed_at, analysis_notes,
    created_at, updated_at, deleted_at, sync_status
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`

const UPSERT_WORD_TOMBSTONE_SQL = `
  ${INSERT_WORD_SQL}
  ON CONFLICT(word_id) DO UPDATE SET
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at,
    sync_status = 'synced'
`

export class WordRepository {
  // Helper to convert undefined to null for SQLite
  private toSqlValue<T>(value: T | undefined): T | null {
    return value === undefined ? null : value
  }

  private toNullableSqlValue(value: string | null | undefined): string | null {
    return value || null
  }

  async saveWords(
    words: Word[],
    options: SaveWordsOptions = {}
  ): Promise<void> {
    const db = await getDatabase()
    const statements = await this.prepareSaveWordStatements(db)

    try {
      const mergedWords = await this.persistWords(words, statements, options)
      this.logMergedWords(mergedWords)
    } finally {
      await this.finalizeSaveWordStatements(statements)
    }
  }

  async saveRemoteWordTombstones(words: RemoteWordTombstone[]): Promise<void> {
    if (words.length === 0) return

    const db = await getDatabase()
    const statement = await db.prepareAsync(UPSERT_WORD_TOMBSTONE_SQL)

    try {
      for (const word of words) {
        await statement.executeAsync(
          ...this.getInsertValues(word, word.deleted_at, 'synced')
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
    const existingWord = await this.findExistingWord(
      statements.checkExisting,
      word
    )

    if (!existingWord) {
      await statements.insert.executeAsync(...this.getInsertValues(word))
      return null
    }

    if (this.shouldPreserveExistingWord(existingWord, options)) {
      return null
    }

    await statements.update.executeAsync(
      ...this.getUpdateValues(word, existingWord.word_id)
    )
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
      UNSYNCED_STATUSES.has(existingWord.sync_status)
    )
  }

  private getInsertValues(
    word: Word,
    deletedAt: string | null = null,
    syncStatus: SyncStatus = 'synced'
  ): SQLiteBindValue[] {
    return [
      this.toSqlValue(word.word_id),
      this.toSqlValue(word.user_id),
      ...this.getMutableWordValues(word, deletedAt, syncStatus),
    ]
  }

  private getUpdateValues(
    word: Word,
    existingWordId: string
  ): SQLiteBindValue[] {
    return [
      this.toSqlValue(word.word_id),
      ...this.getMutableWordValues(word),
      existingWordId,
      word.user_id,
    ]
  }

  private getMutableWordValues(
    word: Word,
    deletedAt: string | null = null,
    syncStatus: SyncStatus = 'synced'
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
      JSON.stringify(this.toSqlValue(word.translations) || []),
      word.examples ? JSON.stringify(word.examples) : null,
      JSON.stringify(this.toSqlValue(word.synonyms) || []),
      JSON.stringify(this.toSqlValue(word.antonyms) || []),
      word.conjugation ? JSON.stringify(word.conjugation) : null,
      this.toNullableSqlValue(word.preposition),
      this.toNullableSqlValue(word.image_url),
      this.toNullableSqlValue(word.tts_url),
      Number(word.interval_days ?? 1),
      Number(word.repetition_count ?? 0),
      Number(word.easiness_factor ?? 2.5),
      this.toSqlValue(word.next_review_date),
      this.toNullableSqlValue(word.last_reviewed_at),
      this.toNullableSqlValue(word.analysis_notes),
      this.toSqlValue(word.created_at),
      this.toSqlValue(word.updated_at),
      deletedAt,
      syncStatus,
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

  async getWordsByUserId(userId: string): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [userId]
    )

    return result.map(row => this.parseWordRow(row))
  }

  async getWordByIdAndUserId(
    wordId: string,
    userId: string
  ): Promise<LocalWord | null> {
    const db = await getDatabase()

    const result = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL',
      [wordId, userId]
    )

    return result ? this.parseWordRow(result) : null
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
      `SELECT * FROM words
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND lower(dutch_lemma) = ?
         AND COALESCE(part_of_speech, 'unknown') = ?
         AND COALESCE(article, '') = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, normalizedLemma, normalizedPartOfSpeech, normalizedArticle]
    )

    return result ? this.parseWordRow(result) : null
  }

  async getWordsByCollectionId(collectionId: string): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE collection_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [collectionId]
    )

    return result.map(row => this.parseWordRow(row))
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
      'SELECT * FROM words WHERE user_id = ? AND updated_at > ? ORDER BY updated_at DESC',
      [userId, timestamp]
    )

    return result.map(row => this.parseWordRow(row))
  }

  async getPendingSyncWords(userId: string): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM words WHERE user_id = ? AND sync_status = 'pending' AND deleted_at IS NULL ORDER BY updated_at ASC",
      [userId]
    )

    return result.map(row => this.parseWordRow(row))
  }

  async markWordsSynced(wordIds: string[]): Promise<void> {
    const db = await getDatabase()

    if (wordIds.length === 0) return

    const placeholders = wordIds.map(() => '?').join(',')
    const statement = await db.prepareAsync(
      `UPDATE words SET sync_status = 'synced', updated_at = ? WHERE word_id IN (${placeholders})`
    )

    try {
      await statement.executeAsync(new Date().toISOString(), ...wordIds)
    } finally {
      await statement.finalizeAsync()
    }
  }

  async markWordsError(wordIds: string[]): Promise<void> {
    const db = await getDatabase()

    if (wordIds.length === 0) return

    const placeholders = wordIds.map(() => '?').join(',')
    const statement = await db.prepareAsync(
      `UPDATE words SET sync_status = 'error', updated_at = ? WHERE word_id IN (${placeholders})`
    )

    try {
      await statement.executeAsync(new Date().toISOString(), ...wordIds)
    } finally {
      await statement.finalizeAsync()
    }
  }

  async deleteWord(wordId: string, userId: string): Promise<void> {
    const db = await getDatabase()
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
    userId: string
  ): Promise<void> {
    const db = await getDatabase()
    const statement = await db.prepareAsync(
      `UPDATE words
       SET deleted_at = ?, updated_at = ?, sync_status = 'deleted'
       WHERE collection_id = ? AND user_id = ? AND deleted_at IS NULL`
    )

    try {
      const deletedAt = new Date().toISOString()
      await statement.executeAsync(deletedAt, deletedAt, collectionId, userId)
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
      `UPDATE words SET sync_status = 'synced'
       WHERE word_id IN (${placeholders}) AND deleted_at IS NOT NULL`
    )

    try {
      await statement.executeAsync(...wordIds)
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
    const db = await getDatabase()

    // Validate word_id before adding
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

    const insertStatement = await db.prepareAsync(`
      INSERT INTO words (
        word_id, user_id, collection_id, dutch_lemma, dutch_original,
        part_of_speech, is_irregular, is_reflexive, is_expression,
        expression_type, is_separable, prefix_part, root_verb, article,
        plural, register, translations, examples, synonyms, antonyms, conjugation,
        preposition, image_url, tts_url, interval_days, repetition_count,
        easiness_factor, next_review_date, last_reviewed_at, analysis_notes,
        created_at, updated_at, deleted_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)

    try {
      await insertStatement.executeAsync(
        word.word_id,
        word.user_id,
        word.collection_id || null,
        word.dutch_lemma,
        word.dutch_original || null,
        word.part_of_speech || null,
        word.is_irregular ? 1 : 0,
        word.is_reflexive ? 1 : 0,
        word.is_expression ? 1 : 0,
        word.expression_type || null,
        word.is_separable ? 1 : 0,
        word.prefix_part || null,
        word.root_verb || null,
        word.article || null,
        word.plural || null,
        word.register || null,
        JSON.stringify(word.translations),
        word.examples ? JSON.stringify(word.examples) : null,
        JSON.stringify(word.synonyms || []),
        JSON.stringify(word.antonyms || []),
        word.conjugation ? JSON.stringify(word.conjugation) : null,
        word.preposition || null,
        word.image_url || null,
        word.tts_url || null,
        word.interval_days,
        word.repetition_count,
        word.easiness_factor,
        word.next_review_date,
        word.last_reviewed_at || null,
        word.analysis_notes || null,
        word.created_at,
        word.updated_at,
        null,
        'pending'
      )
    } finally {
      await insertStatement.finalizeAsync()
    }
  }

  async updateWordImage(
    wordId: string,
    userId: string,
    imageUrl: string
  ): Promise<void> {
    const db = await getDatabase()

    const updateStatement = await db.prepareAsync(
      'UPDATE words SET image_url = ?, updated_at = ?, sync_status = ? WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL'
    )

    try {
      await updateStatement.executeAsync(
        imageUrl,
        new Date().toISOString(),
        'pending',
        wordId,
        userId
      )
    } finally {
      await updateStatement.finalizeAsync()
    }
  }

  async moveWordToCollection(
    wordId: string,
    userId: string,
    newCollectionId: string
  ): Promise<void> {
    const db = await getDatabase()

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

    const updateStatement = await db.prepareAsync(`
      UPDATE words SET
        interval_days = ?,
        repetition_count = ?,
        easiness_factor = ?,
        next_review_date = ?,
        last_reviewed_at = NULL,
        updated_at = ?,
        sync_status = ?
      WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL
    `)

    try {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0] // Store-only date: "2025-12-22"

      await updateStatement.executeAsync(
        1,
        0,
        2.5,
        tomorrow,
        new Date().toISOString(),
        'pending',
        wordId,
        userId
      )
    } finally {
      await updateStatement.finalizeAsync()
    }
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
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: (row.deleted_at as string) || null,
      sync_status: (row.sync_status as SyncStatus) || 'synced',
    }
  }
}

export const wordRepository = new WordRepository()
