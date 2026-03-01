import { getDatabase } from './initDB'
import type { SQLiteBindValue } from 'expo-sqlite'
import type { Collection } from '@/types/database'

export interface LocalCollection extends Collection {
  sync_status: 'synced' | 'pending' | 'error' | 'conflict'
}

export class CollectionRepository {
  async saveCollections(
    collections: Collection[],
    syncStatus: LocalCollection['sync_status'] = 'synced'
  ): Promise<void> {
    const db = await getDatabase()

    try {
      for (const collection of collections) {
        const now = new Date().toISOString()
        const params = [
          collection.collection_id,
          collection.user_id,
          collection.name,
          collection.description || null,
          collection.is_shared ? 1 : 0,
          collection.shared_with
            ? JSON.stringify(collection.shared_with)
            : null,
          collection.created_at,
          collection.updated_at || now,
          syncStatus,
        ]

        await db.runAsync(
          `INSERT OR REPLACE INTO collections (
            collection_id, user_id, name, description,
            is_shared, shared_with, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params
        )
      }
      console.log(`[DB] Saved ${collections.length} collections`)
    } catch (error) {
      console.error('[DB] Error saving collections:', error)
      throw error
    }
  }

  async getCollectionsByUserId(userId: string): Promise<LocalCollection[]> {
    const db = await getDatabase()

    try {
      const result = await db.getAllAsync<LocalCollection>(
        `SELECT * FROM collections WHERE user_id = ? AND COALESCE(sync_status, 'synced') != 'deleted' ORDER BY created_at DESC`,
        [userId]
      )
      console.log(`[DB] Retrieved ${result.length} collections for user`)
      return result || []
    } catch (error) {
      console.error('[DB] Error retrieving collections:', error)
      throw error
    }
  }

  async getCollectionsByIds(
    collectionIds: string[],
    userId: string
  ): Promise<LocalCollection[]> {
    const db = await getDatabase()

    if (collectionIds.length === 0) return []

    try {
      const placeholders = collectionIds.map(() => '?').join(',')
      const result = await db.getAllAsync<LocalCollection>(
        `SELECT * FROM collections WHERE user_id = ? AND collection_id IN (${placeholders}) AND COALESCE(sync_status, 'synced') != 'deleted'`,
        [userId, ...collectionIds]
      )
      return result || []
    } catch (error) {
      console.error('[DB] Error retrieving collections by IDs:', error)
      throw error
    }
  }

  async getCollectionById(
    collectionId: string,
    userId: string
  ): Promise<LocalCollection | null> {
    const db = await getDatabase()

    try {
      // Using new tagged template literals API (SDK 55+)
      const result = await db.sql<LocalCollection>`
        SELECT * FROM collections
        WHERE collection_id = ${collectionId} AND user_id = ${userId}
      `.first()
      return result || null
    } catch (error) {
      console.error('[DB] Error retrieving collection:', error)
      throw error
    }
  }

  async deleteCollection(collectionId: string): Promise<void> {
    const db = await getDatabase()

    try {
      // Using new tagged template literals API (SDK 55+)
      await db.sql`DELETE FROM collections WHERE collection_id = ${collectionId}`
      console.log(`[DB] Deleted collection ${collectionId}`)
    } catch (error) {
      console.error('[DB] Error deleting collection:', error)
      throw error
    }
  }

  async markCollectionDeleted(collectionId: string): Promise<void> {
    const db = await getDatabase()

    try {
      await db.runAsync(
        `UPDATE collections SET sync_status = 'deleted', updated_at = ? WHERE collection_id = ?`,
        [new Date().toISOString(), collectionId]
      )
      console.log('[DB] Marked collection deleted', collectionId)
    } catch (error) {
      console.error('[DB] Error marking collection deleted:', error)
      throw error
    }
  }

  async updateCollection(
    collectionId: string,
    updates: Partial<LocalCollection>
  ): Promise<void> {
    const db = await getDatabase()

    try {
      const now = new Date().toISOString()
      const updateFields: string[] = []
      const updateValues: SQLiteBindValue[] = []

      if ('name' in updates) {
        updateFields.push('name = ?')
        updateValues.push(updates.name ?? null)
      }

      if ('description' in updates) {
        updateFields.push('description = ?')
        updateValues.push(updates.description || null)
      }

      if ('is_shared' in updates) {
        updateFields.push('is_shared = ?')
        updateValues.push(updates.is_shared ? 1 : 0)
      }

      if ('shared_with' in updates) {
        updateFields.push('shared_with = ?')
        updateValues.push(
          updates.shared_with ? JSON.stringify(updates.shared_with) : null
        )
      }

      updateFields.push('updated_at = ?')
      updateValues.push(now)

      updateFields.push('sync_status = ?')
      updateValues.push('pending')

      updateValues.push(collectionId)

      await db.runAsync(
        `UPDATE collections SET ${updateFields.join(', ')} WHERE collection_id = ?`,
        updateValues
      )

      console.log(`[DB] Updated collection ${collectionId}`)
    } catch (error) {
      console.error('[DB] Error updating collection:', error)
      throw error
    }
  }

  async getPendingSyncCollections(userId: string): Promise<LocalCollection[]> {
    const db = await getDatabase()

    try {
      const result = await db.getAllAsync<LocalCollection>(
        `SELECT * FROM collections WHERE user_id = ? AND sync_status = 'pending'`,
        [userId]
      )
      return result || []
    } catch (error) {
      console.error('[DB] Error retrieving pending collections:', error)
      throw error
    }
  }

  async markCollectionsSynced(collectionIds: string[]): Promise<void> {
    const db = await getDatabase()

    if (collectionIds.length === 0) return

    try {
      const placeholders = collectionIds.map(() => '?').join(',')
      await db.runAsync(
        `UPDATE collections SET sync_status = 'synced' WHERE collection_id IN (${placeholders})`,
        collectionIds
      )
      console.log(`[DB] Marked ${collectionIds.length} collections as synced`)
    } catch (error) {
      console.error('[DB] Error marking collections synced:', error)
      throw error
    }
  }

  async getDeletedCollections(userId: string): Promise<LocalCollection[]> {
    const db = await getDatabase()

    try {
      const result = await db.getAllAsync<LocalCollection>(
        `SELECT * FROM collections WHERE user_id = ? AND sync_status = 'deleted'`,
        [userId]
      )
      console.log(`[DB] Retrieved ${result.length} deleted collections`)
      return result || []
    } catch (error) {
      console.error('[DB] Error retrieving deleted collections:', error)
      throw error
    }
  }
}

export const collectionRepository = new CollectionRepository()
