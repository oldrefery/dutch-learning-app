import { getDatabase } from './initDB'
import { Word } from '@/types/database'
import type { SyncStatus } from './schema'

export interface LocalWord extends Word {
  sync_status: SyncStatus
}

export class WordRepository {
  async saveWords(words: Word[]): Promise<void> {
    const db = await getDatabase()

    const insertStatement = await db.prepareAsync(`
      INSERT OR REPLACE INTO words (
        word_id, user_id, collection_id, dutch_lemma, dutch_original,
        part_of_speech, is_irregular, is_reflexive, is_expression,
        expression_type, is_separable, prefix_part, root_verb, article,
        plural, translations, examples, synonyms, antonyms, conjugation,
        preposition, image_url, tts_url, interval_days, repetition_count,
        easiness_factor, next_review_date, last_reviewed_at, analysis_notes,
        created_at, updated_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)

    try {
      for (const word of words) {
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
          'synced'
        )
      }
    } finally {
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
    const values: unknown[] = []

    if ('interval_days' in progress) {
      fields.push('interval_days = ?')
      values.push(progress.interval_days)
    }
    if ('repetition_count' in progress) {
      fields.push('repetition_count = ?')
      values.push(progress.repetition_count)
    }
    if ('easiness_factor' in progress) {
      fields.push('easiness_factor = ?')
      values.push(progress.easiness_factor)
    }
    if ('next_review_date' in progress) {
      fields.push('next_review_date = ?')
      values.push(progress.next_review_date)
    }
    if ('last_reviewed_at' in progress) {
      fields.push('last_reviewed_at = ?')
      values.push(progress.last_reviewed_at)
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

  async addWord(word: Word): Promise<void> {
    const db = await getDatabase()

    const insertStatement = await db.prepareAsync(`
      INSERT OR REPLACE INTO words (
        word_id, user_id, collection_id, dutch_lemma, dutch_original,
        part_of_speech, is_irregular, is_reflexive, is_expression,
        expression_type, is_separable, prefix_part, root_verb, article,
        plural, translations, examples, synonyms, antonyms, conjugation,
        preposition, image_url, tts_url, interval_days, repetition_count,
        easiness_factor, next_review_date, last_reviewed_at, analysis_notes,
        created_at, updated_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
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
      await updateStatement.executeAsync(
        1,
        0,
        2.5,
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
      expression_type: (row.expression_type as unknown) || undefined,
      is_separable: Boolean(row.is_separable),
      prefix_part: (row.prefix_part as string) || null,
      root_verb: (row.root_verb as string) || null,
      article: (row.article as 'de' | 'het') || null,
      plural: (row.plural as string) || null,
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
      sync_status: (row.sync_status as SyncStatus) || 'synced',
    }
  }
}

export const wordRepository = new WordRepository()
