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
  deleted_at: string | null
  sync_status: SyncStatus
  last_sync_attempt_at: string | null
  synced_at: string | null
}

export type ProgressRecord = Omit<
  UserProgress,
  'sync_status' | 'deleted_at' | 'last_sync_attempt_at' | 'synced_at'
>

interface SaveProgressOptions {
  preserveUnsynced?: boolean
}

export interface RemoteProgressTombstone extends ProgressRecord {
  deleted_at: string
}

export interface ProgressSyncAcknowledgement {
  progress_id: string
  updated_at: string
  deleted_at: string | null
}

const UNSYNCED_PROGRESS_STATUSES: SyncStatus[] = [
  'pending',
  'error',
  'conflict',
  'deleted',
]

const SAVE_PROGRESS_SQL = `
  INSERT INTO user_progress (
    progress_id, user_id, word_id, status, reviewed_count,
    last_reviewed_at, created_at, updated_at, deleted_at, sync_status,
    last_sync_attempt_at, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(progress_id) DO UPDATE SET
    word_id = excluded.word_id,
    status = excluded.status,
    reviewed_count = excluded.reviewed_count,
    last_reviewed_at = excluded.last_reviewed_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    sync_status = 'synced',
    last_sync_attempt_at = user_progress.last_sync_attempt_at,
    synced_at = excluded.synced_at
  WHERE user_progress.deleted_at IS NULL
`

const SAVE_REMOTE_PROGRESS_TOMBSTONE_SQL = `
  INSERT INTO user_progress (
    progress_id, user_id, word_id, status, reviewed_count,
    last_reviewed_at, created_at, updated_at, deleted_at, sync_status,
    last_sync_attempt_at, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(progress_id) DO UPDATE SET
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at,
    sync_status = 'synced',
    last_sync_attempt_at = user_progress.last_sync_attempt_at,
    synced_at = excluded.synced_at
  WHERE user_progress.user_id = excluded.user_id
`

export class ProgressRepository {
  async saveProgress(
    progressRecords: ProgressRecord[],
    options: SaveProgressOptions = {}
  ): Promise<void> {
    const db = await getDatabase()
    const preserveClause = options.preserveUnsynced
      ? ` AND user_progress.sync_status NOT IN (${UNSYNCED_PROGRESS_STATUSES.map(
          () => '?'
        ).join(', ')})`
      : ''
    const insertStatement = await db.prepareAsync(
      `${SAVE_PROGRESS_SQL}${preserveClause}`
    )
    const syncedAt = new Date().toISOString()

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
          null,
          'synced',
          null,
          syncedAt,
          ...(options.preserveUnsynced ? UNSYNCED_PROGRESS_STATUSES : [])
        )
      }
    } finally {
      await insertStatement.finalizeAsync()
    }
  }

  async saveRemoteProgressTombstones(
    progressRecords: RemoteProgressTombstone[]
  ): Promise<void> {
    if (progressRecords.length === 0) return

    const db = await getDatabase()
    const statement = await db.prepareAsync(SAVE_REMOTE_PROGRESS_TOMBSTONE_SQL)
    const syncedAt = new Date().toISOString()

    try {
      for (const record of progressRecords) {
        await statement.executeAsync(
          record.progress_id,
          record.user_id,
          record.word_id,
          record.status,
          record.reviewed_count,
          record.last_reviewed_at,
          record.created_at,
          record.updated_at,
          record.deleted_at,
          'synced',
          null,
          syncedAt
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  }

  async updateProgress(
    progressId: string,
    userId: string,
    updates: Partial<
      Omit<
        UserProgress,
        'progress_id' | 'user_id' | 'sync_status' | 'deleted_at'
      >
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
      `UPDATE user_progress SET ${fields.join(', ')} WHERE progress_id = ? AND user_id = ? AND deleted_at IS NULL`
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
      'SELECT * FROM user_progress WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
      [userId]
    )

    return result.map(row => this.parseProgressRow(row))
  }

  async getProgressByWordId(wordId: string): Promise<UserProgress[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE word_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
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
      'SELECT * FROM user_progress WHERE progress_id = ? AND user_id = ? AND deleted_at IS NULL',
      [progressId, userId]
    )

    return result ? this.parseProgressRow(result) : null
  }

  async getPendingSyncProgress(userId: string): Promise<UserProgress[]> {
    const db = await getDatabase()

    const result = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM user_progress WHERE user_id = ? AND sync_status = 'pending' AND deleted_at IS NULL ORDER BY updated_at ASC",
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
      `UPDATE user_progress
       SET sync_status = 'synced', last_sync_attempt_at = ?, synced_at = ?
       WHERE progress_id IN (${placeholders})`
    )

    try {
      const syncedAt = new Date().toISOString()
      await statement.executeAsync(syncedAt, syncedAt, ...progressIds)
    } finally {
      await statement.finalizeAsync()
    }
  }

  async reconcilePushedProgress(
    acknowledgements: ProgressSyncAcknowledgement[],
    expectedUpdatedAtById: ReadonlyMap<string, string>
  ): Promise<void> {
    if (acknowledgements.length === 0) return

    const expectedTimestamps = acknowledgements.map(acknowledgement => {
      const expectedUpdatedAt = expectedUpdatedAtById.get(
        acknowledgement.progress_id
      )
      if (!expectedUpdatedAt) {
        throw new Error(
          `Missing local progress timestamp for ${acknowledgement.progress_id}`
        )
      }
      return expectedUpdatedAt
    })
    const db = await getDatabase()
    const statement = await db.prepareAsync(
      `UPDATE user_progress
       SET sync_status = 'synced',
           updated_at = ?,
           deleted_at = ?,
           last_sync_attempt_at = ?,
           synced_at = ?
       WHERE progress_id = ?
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
          acknowledgement.progress_id,
          expectedTimestamps[index]
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  }

  async deleteProgress(progressId: string, userId: string): Promise<void> {
    const db = await getDatabase()
    const statement = await db.prepareAsync(
      `UPDATE user_progress
       SET deleted_at = ?, updated_at = ?, sync_status = 'deleted'
       WHERE progress_id = ? AND user_id = ? AND deleted_at IS NULL`
    )

    try {
      const deletedAt = new Date().toISOString()
      await statement.executeAsync(deletedAt, deletedAt, progressId, userId)
    } finally {
      await statement.finalizeAsync()
    }
  }

  async getDeletedProgress(userId: string): Promise<UserProgress[]> {
    const db = await getDatabase()
    const result = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM user_progress WHERE user_id = ? AND sync_status = 'deleted' AND deleted_at IS NOT NULL ORDER BY updated_at ASC",
      [userId]
    )

    return result.map(row => this.parseProgressRow(row))
  }

  async markProgressTombstonesSynced(progressIds: string[]): Promise<void> {
    if (progressIds.length === 0) return

    const db = await getDatabase()
    const placeholders = progressIds.map(() => '?').join(',')
    const statement = await db.prepareAsync(
      `UPDATE user_progress
       SET sync_status = 'synced', last_sync_attempt_at = ?, synced_at = ?
       WHERE progress_id IN (${placeholders}) AND deleted_at IS NOT NULL`
    )

    try {
      const syncedAt = new Date().toISOString()
      await statement.executeAsync(syncedAt, syncedAt, ...progressIds)
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
      deleted_at: (row.deleted_at as string) || null,
      sync_status: (row.sync_status as SyncStatus) || 'synced',
      last_sync_attempt_at: (row.last_sync_attempt_at as string) || null,
      synced_at: (row.synced_at as string) || null,
    }
  }
}

export const progressRepository = new ProgressRepository()
