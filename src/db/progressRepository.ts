import { getDatabase } from './initDB'
import type { SQLiteBindValue } from 'expo-sqlite'
import type { SyncStatus } from './schema'

export interface UserProgress {
  progress_id: string
  user_id: string
  word_id: string
  status: string
  reviewed_count: number
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}

export class ProgressRepository {
  async saveProgress(
    progressRecords: Omit<UserProgress, 'sync_status'>[]
  ): Promise<void> {
    const db = await getDatabase()

    const insertStatement = await db.prepareAsync(`
      INSERT OR REPLACE INTO user_progress (
        progress_id, user_id, word_id, status, reviewed_count,
        last_reviewed_at, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    try {
      for (const record of progressRecords) {
        await insertStatement.executeAsync(
          record.progress_id,
          record.user_id,
          record.word_id,
          record.status,
          record.reviewed_count,
          record.last_reviewed_at || null,
          record.created_at,
          record.updated_at,
          'synced'
        )
      }
    } finally {
      await insertStatement.finalizeAsync()
    }
  }

  async updateProgress(
    progressId: string,
    userId: string,
    updates: Partial<
      Omit<UserProgress, 'progress_id' | 'user_id' | 'sync_status'>
    >
  ): Promise<void> {
    const db = await getDatabase()

    const fields: string[] = []
    const values: SQLiteBindValue[] = []

    if ('status' in updates) {
      fields.push('status = ?')
      values.push(updates.status ?? null)
    }
    if ('reviewed_count' in updates) {
      fields.push('reviewed_count = ?')
      values.push(updates.reviewed_count ?? null)
    }
    if ('last_reviewed_at' in updates) {
      fields.push('last_reviewed_at = ?')
      values.push(updates.last_reviewed_at ?? null)
    }

    if (fields.length === 0) {
      return
    }

    fields.push('updated_at = ?')
    values.push(new Date().toISOString())
    fields.push('sync_status = ?')
    values.push('pending')
    values.push(progressId)
    values.push(userId)

    const updateStatement = await db.prepareAsync(
      `UPDATE user_progress SET ${fields.join(', ')} WHERE progress_id = ? AND user_id = ?`
    )

    try {
      await updateStatement.executeAsync(...values)
    } finally {
      await updateStatement.finalizeAsync()
    }
  }

  async getProgressByUserId(userId: string): Promise<UserProgress[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    )

    return result.map(row => this.parseProgressRow(row))
  }

  async getProgressByWordId(wordId: string): Promise<UserProgress[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE word_id = ? ORDER BY updated_at DESC',
      [wordId]
    )

    return result.map(row => this.parseProgressRow(row))
  }

  async getProgressByIdAndUserId(
    progressId: string,
    userId: string
  ): Promise<UserProgress | null> {
    const db = await getDatabase()

    const result = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE progress_id = ? AND user_id = ?',
      [progressId, userId]
    )

    return result ? this.parseProgressRow(result) : null
  }

  async getPendingSyncProgress(userId: string): Promise<UserProgress[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM user_progress WHERE user_id = ? AND sync_status = 'pending' ORDER BY updated_at ASC",
      [userId]
    )

    return result.map(row => this.parseProgressRow(row))
  }

  async getUpdatedSince(
    timestamp: string,
    userId: string
  ): Promise<UserProgress[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE user_id = ? AND updated_at > ? ORDER BY updated_at DESC',
      [userId, timestamp]
    )

    return result.map(row => this.parseProgressRow(row))
  }

  async markProgressSynced(progressIds: string[]): Promise<void> {
    const db = await getDatabase()

    if (progressIds.length === 0) return

    const placeholders = progressIds.map(() => '?').join(',')
    const statement = await db.prepareAsync(
      `UPDATE user_progress SET sync_status = 'synced', updated_at = ? WHERE progress_id IN (${placeholders})`
    )

    try {
      await statement.executeAsync(new Date().toISOString(), ...progressIds)
    } finally {
      await statement.finalizeAsync()
    }
  }

  async deleteProgress(progressId: string, userId: string): Promise<void> {
    const db = await getDatabase()
    const statement = await db.prepareAsync(
      'DELETE FROM user_progress WHERE progress_id = ? AND user_id = ?'
    )

    try {
      await statement.executeAsync(progressId, userId)
    } finally {
      await statement.finalizeAsync()
    }
  }

  private parseProgressRow(row: Record<string, unknown>): UserProgress {
    return {
      progress_id: row.progress_id as string,
      user_id: row.user_id as string,
      word_id: row.word_id as string,
      status: row.status as string,
      reviewed_count: row.reviewed_count as number,
      last_reviewed_at: (row.last_reviewed_at as string) || null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      sync_status: (row.sync_status as SyncStatus) || 'synced',
    }
  }
}

export const progressRepository = new ProgressRepository()
