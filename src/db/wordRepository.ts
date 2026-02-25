import { getDatabase } from './initDB'
import type { SQLiteBindValue } from 'expo-sqlite'
import { Word } from '@/types/database'
import type { SyncStatus } from './schema'
import { Sentry } from '@/lib/sentry'

export interface LocalWord extends Word {
  sync_status: SyncStatus
}

// Type for existing word check result
interface ExistingWordCheck {
  word_id: string
  sync_status: string
  updated_at: string
}

export class WordRepository {
  // Helper to convert undefined to null for SQLite
  private toSqlValue<T>(value: T | undefined): T | null {
    return value === undefined ? null : value
  }

  async saveWords(words: Word[]): Promise<void> {
    const db = await getDatabase()

    // Prepare statement to check for existing word by semantic key
    const checkExistingStatement = await db.prepareAsync(`
      SELECT word_id, sync_status, updated_at
      FROM words
      WHERE user_id = ?
        AND LOWER(dutch_lemma) = LOWER(?)
        AND COALESCE(part_of_speech, 'unknown') = ?
        AND COALESCE(article, '') = ?
      LIMIT 1
    `)

    // UPDATE statement for when semantic key already exists
    const updateStatement = await db.prepareAsync(`
      UPDATE words SET
        word_id = ?,
        collection_id = ?,
        dutch_original = ?,
        is_irregular = ?,
        is_reflexive = ?,
        is_expression = ?,
        expression_type = ?,
        is_separable = ?,
        prefix_part = ?,
        root_verb = ?,
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
        sync_status = ?
      WHERE user_id = ?
        AND LOWER(dutch_lemma) = LOWER(?)
        AND COALESCE(part_of_speech, 'unknown') = ?
        AND COALESCE(article, '') = ?
    `)

    // INSERT statement for new words (using semantic key values)
    const insertStatement = await db.prepareAsync(`
      INSERT INTO words (
        word_id, user_id, collection_id, dutch_lemma, dutch_original,
        part_of_speech, is_irregular, is_reflexive, is_expression,
        expression_type, is_separable, prefix_part, root_verb, article,
        plural, register, translations, examples, synonyms, antonyms, conjugation,
        preposition, image_url, tts_url, interval_days, repetition_count,
        easiness_factor, next_review_date, last_reviewed_at, analysis_notes,
        created_at, updated_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)

    try {
      let mergedCount = 0
      const mergedWords: {
        dutch_lemma: string
        existing_id: string
        incoming_id: string
      }[] = []

      for (const word of words) {
        const normalizedPartOfSpeech = word.part_of_speech || 'unknown'
        const normalizedArticle =
          word.article && word.article.trim() !== '' ? word.article.trim() : ''

        // Check if word with same semantic key already exists
        const existingResult =
          await checkExistingStatement.executeAsync<ExistingWordCheck>(
            word.user_id,
            word.dutch_lemma,
            normalizedPartOfSpeech,
            normalizedArticle
          )
        const existingWord = await existingResult.getFirstAsync()

        if (existingWord) {
          // Word with same semantic key exists - update it with the incoming data
          // This handles the case where local word has UUID-A and server has UUID-B
          mergedCount++
          mergedWords.push({
            dutch_lemma: word.dutch_lemma,
            existing_id: existingWord.word_id,
            incoming_id: word.word_id,
          })

          await updateStatement.executeAsync(
            this.toSqlValue(word.word_id), // Update to server's word_id
            this.toSqlValue(word.collection_id) || null,
            this.toSqlValue(word.dutch_original) || null,
            word.is_irregular ? 1 : 0,
            word.is_reflexive ? 1 : 0,
            word.is_expression ? 1 : 0,
            this.toSqlValue(word.expression_type) || null,
            word.is_separable ? 1 : 0,
            this.toSqlValue(word.prefix_part) || null,
            this.toSqlValue(word.root_verb) || null,
            this.toSqlValue(word.plural) || null,
            this.toSqlValue(word.register) || null,
            JSON.stringify(this.toSqlValue(word.translations) || []),
            word.examples ? JSON.stringify(word.examples) : null,
            JSON.stringify(this.toSqlValue(word.synonyms) || []),
            JSON.stringify(this.toSqlValue(word.antonyms) || []),
            word.conjugation ? JSON.stringify(word.conjugation) : null,
            this.toSqlValue(word.preposition) || null,
            this.toSqlValue(word.image_url) || null,
            this.toSqlValue(word.tts_url) || null,
            Number(word.interval_days ?? 1),
            Number(word.repetition_count ?? 0),
            Number(word.easiness_factor ?? 2.5),
            this.toSqlValue(word.next_review_date),
            this.toSqlValue(word.last_reviewed_at) || null,
            this.toSqlValue(word.analysis_notes) || null,
            this.toSqlValue(word.created_at),
            this.toSqlValue(word.updated_at),
            'synced',
            // WHERE clause params
            word.user_id,
            word.dutch_lemma,
            normalizedPartOfSpeech,
            normalizedArticle
          )
        } else {
          // No existing word - insert new
          await insertStatement.executeAsync(
            this.toSqlValue(word.word_id),
            this.toSqlValue(word.user_id),
            this.toSqlValue(word.collection_id) || null,
            this.toSqlValue(word.dutch_lemma),
            this.toSqlValue(word.dutch_original) || null,
            this.toSqlValue(word.part_of_speech) || null,
            word.is_irregular ? 1 : 0,
            word.is_reflexive ? 1 : 0,
            word.is_expression ? 1 : 0,
            this.toSqlValue(word.expression_type) || null,
            word.is_separable ? 1 : 0,
            this.toSqlValue(word.prefix_part) || null,
            this.toSqlValue(word.root_verb) || null,
            this.toSqlValue(word.article) || null,
            this.toSqlValue(word.plural) || null,
            this.toSqlValue(word.register) || null,
            JSON.stringify(this.toSqlValue(word.translations) || []),
            word.examples ? JSON.stringify(word.examples) : null,
            JSON.stringify(this.toSqlValue(word.synonyms) || []),
            JSON.stringify(this.toSqlValue(word.antonyms) || []),
            word.conjugation ? JSON.stringify(word.conjugation) : null,
            this.toSqlValue(word.preposition) || null,
            this.toSqlValue(word.image_url) || null,
            this.toSqlValue(word.tts_url) || null,
            Number(word.interval_days ?? 1),
            Number(word.repetition_count ?? 0),
            Number(word.easiness_factor ?? 2.5),
            this.toSqlValue(word.next_review_date),
            this.toSqlValue(word.last_reviewed_at) || null,
            this.toSqlValue(word.analysis_notes) || null,
            this.toSqlValue(word.created_at),
            this.toSqlValue(word.updated_at),
            'synced'
          )
        }
      }

      // Log merged words to Sentry for debugging
      if (mergedCount > 0) {
        console.log(
          `[WordRepository] Merged ${mergedCount} words with existing semantic keys`
        )
        Sentry.addBreadcrumb({
          category: 'db.saveWords',
          message: `Merged ${mergedCount} words with existing semantic keys`,
          level: 'info',
          data: {
            mergedCount,
            mergedWords: mergedWords.slice(0, 10), // Limit to first 10 for breadcrumb
          },
        })
      }
    } finally {
      await checkExistingStatement.finalizeAsync()
      await updateStatement.finalizeAsync()
      await insertStatement.finalizeAsync()
    }
  }

  async getWordsByUserId(userId: string): Promise<LocalWord[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE user_id = ? ORDER BY created_at DESC',
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
      'SELECT * FROM words WHERE word_id = ? AND user_id = ?',
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
      'SELECT * FROM words WHERE collection_id = ? ORDER BY created_at DESC',
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
      `UPDATE words SET ${fields.join(', ')} WHERE word_id = ? AND user_id = ?`
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
      "SELECT * FROM words WHERE user_id = ? AND sync_status = 'pending' ORDER BY updated_at ASC",
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
      'DELETE FROM words WHERE word_id = ? AND user_id = ?'
    )

    try {
      await statement.executeAsync(wordId, userId)
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
      'DELETE FROM words WHERE collection_id = ? AND user_id = ?'
    )

    try {
      await statement.executeAsync(collectionId, userId)
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
      `DELETE FROM words
       WHERE user_id = ?
         AND (
           collection_id IS NULL
           OR collection_id NOT IN (
             SELECT collection_id FROM collections WHERE user_id = ?
           )
         )`
    )

    try {
      const result = await statement.executeAsync(userId, userId)
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
      INSERT OR REPLACE INTO words (
        word_id, user_id, collection_id, dutch_lemma, dutch_original,
        part_of_speech, is_irregular, is_reflexive, is_expression,
        expression_type, is_separable, prefix_part, root_verb, article,
        plural, register, translations, examples, synonyms, antonyms, conjugation,
        preposition, image_url, tts_url, interval_days, repetition_count,
        easiness_factor, next_review_date, last_reviewed_at, analysis_notes,
        created_at, updated_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      'UPDATE words SET image_url = ?, updated_at = ?, sync_status = ? WHERE word_id = ? AND user_id = ?'
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
      'UPDATE words SET collection_id = ?, updated_at = ?, sync_status = ? WHERE word_id = ? AND user_id = ?'
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
      WHERE word_id = ? AND user_id = ?
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
      sync_status: (row.sync_status as SyncStatus) || 'synced',
    }
  }
}

export const wordRepository = new WordRepository()
