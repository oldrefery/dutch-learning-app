import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  SQL_SCHEMA,
  MIGRATION_V3_UNIQUE_INDEX,
  MIGRATION_V4_ADD_REGISTER,
} from './schema'
import { Sentry } from '@/lib/sentry'

const DB_NAME = 'dutch_learning.db'
const SCHEMA_VERSION_KEY = 'db_schema_version'
const SCHEMA_VERSION = 4

// Type for duplicate word record
interface DuplicateWordRecord {
  user_id: string
  dutch_lemma: string
  part_of_speech: string | null
  article: string | null
  duplicate_count: number
}

// Type for word to keep during deduplication
interface WordToKeep {
  word_id: string
  dutch_lemma: string
  sync_status: string
  updated_at: string
}

let database: SQLite.SQLiteDatabase | null = null

/**
 * Migration v3: Deduplicate existing words and create unique semantic index
 * Priority: synced > pending, newer updated_at wins within same sync_status
 */
async function migrateToV3(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DB] Starting migration to v3: deduplicating words...')

  // Find all duplicate semantic keys
  const duplicates = await db.getAllAsync<DuplicateWordRecord>(`
    SELECT
      user_id,
      dutch_lemma,
      COALESCE(part_of_speech, 'unknown') as part_of_speech,
      COALESCE(article, '') as article,
      COUNT(*) as duplicate_count
    FROM words
    GROUP BY
      user_id,
      LOWER(dutch_lemma),
      COALESCE(part_of_speech, 'unknown'),
      COALESCE(article, '')
    HAVING COUNT(*) > 1
  `)

  if (duplicates.length > 0) {
    console.log(`[DB] Found ${duplicates.length} semantic keys with duplicates`)

    // Log to Sentry for debugging
    Sentry.addBreadcrumb({
      category: 'db.migration',
      message: `Found ${duplicates.length} duplicate semantic keys during v3 migration`,
      level: 'info',
      data: { duplicateCount: duplicates.length },
    })

    let totalDeduplicatedCount = 0
    const deduplicatedWords: {
      dutch_lemma: string
      kept_id: string
      removed_ids: string[]
    }[] = []

    for (const dup of duplicates) {
      // Get all words with this semantic key, ordered by preference:
      // 1. synced > pending (synced words are already on server)
      // 2. newer updated_at wins within same sync_status
      const wordsWithKey = await db.getAllAsync<WordToKeep>(
        `
        SELECT word_id, dutch_lemma, sync_status, updated_at
        FROM words
        WHERE user_id = ?
          AND LOWER(dutch_lemma) = LOWER(?)
          AND COALESCE(part_of_speech, 'unknown') = ?
          AND COALESCE(article, '') = ?
        ORDER BY
          CASE WHEN sync_status = 'synced' THEN 0 ELSE 1 END,
          updated_at DESC
      `,
        [dup.user_id, dup.dutch_lemma, dup.part_of_speech, dup.article]
      )

      if (wordsWithKey.length > 1) {
        // Keep the first one (best according to our ordering)
        const [wordToKeep, ...wordsToDelete] = wordsWithKey
        const idsToDelete = wordsToDelete.map(w => w.word_id)

        if (idsToDelete.length > 0) {
          const placeholders = idsToDelete.map(() => '?').join(',')
          await db.runAsync(
            `DELETE FROM words WHERE word_id IN (${placeholders})`,
            idsToDelete
          )

          totalDeduplicatedCount += idsToDelete.length
          deduplicatedWords.push({
            dutch_lemma: dup.dutch_lemma,
            kept_id: wordToKeep.word_id,
            removed_ids: idsToDelete,
          })
        }
      }
    }

    console.log(`[DB] Removed ${totalDeduplicatedCount} duplicate words`)

    // Log deduplication details to Sentry
    if (deduplicatedWords.length > 0) {
      Sentry.captureMessage('Database migration v3: deduplicated words', {
        level: 'info',
        extra: {
          totalDuplicatesRemoved: totalDeduplicatedCount,
          deduplicatedWords: deduplicatedWords.slice(0, 50), // Limit to first 50 for Sentry
          totalUniqueKeysAffected: deduplicatedWords.length,
        },
      })
    }
  } else {
    console.log('[DB] No duplicate words found')
  }

  // Create the unique index
  console.log('[DB] Creating unique semantic index...')
  await db.execAsync(MIGRATION_V3_UNIQUE_INDEX)
  console.log('[DB] Migration to v3 completed successfully')
}

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    return database
  }

  try {
    database = await SQLite.openDatabaseAsync(DB_NAME, {
      useNewConnection: true,
    })

    // Check schema version
    const existingVersion = await AsyncStorage.getItem(SCHEMA_VERSION_KEY)
    const currentVersion = parseInt(existingVersion || '0', 10)

    if (currentVersion < SCHEMA_VERSION) {
      // Execute base schema creation for fresh install or upgrade
      if (currentVersion < 2) {
        const statements = SQL_SCHEMA.split(';').filter(stmt => stmt.trim())
        for (const statement of statements) {
          if (statement.trim()) {
            await database.execAsync(statement)
          }
        }
        console.log('[DB] Base schema created (v2)')
      }

      // Migration v2 -> v3: Add unique semantic index
      if (currentVersion < 3) {
        await migrateToV3(database)
      }

      // Migration v3 -> v4: Add register column
      if (currentVersion < 4) {
        console.log('[DB] Starting migration to v4: adding register column...')
        try {
          await database.execAsync(MIGRATION_V4_ADD_REGISTER)
          console.log('[DB] Migration to v4 completed successfully')
        } catch (error) {
          // Column might already exist if schema was created fresh
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          if (!errorMessage.includes('duplicate column name')) {
            throw error
          }
          console.log('[DB] Register column already exists, skipping migration')
        }
      }

      // Update schema version
      await AsyncStorage.setItem(SCHEMA_VERSION_KEY, SCHEMA_VERSION.toString())

      console.log(
        '[DB] Database initialized with schema version',
        SCHEMA_VERSION
      )
    } else {
      console.log('[DB] Database already initialized')
    }

    return database
  } catch (error) {
    console.error('[DB] Error initializing database:', error)
    throw new Error(
      `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    return initializeDatabase()
  }
  return database
}

export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.closeAsync()
    database = null
  }
}

export async function resetDatabase(): Promise<void> {
  try {
    const db = await getDatabase()
    const statements = [
      'DROP TABLE IF EXISTS user_progress',
      'DROP TABLE IF EXISTS words',
      'DROP TABLE IF EXISTS collections',
      'DROP TABLE IF EXISTS sync_metadata',
    ]
    for (const statement of statements) {
      await db.execAsync(statement)
    }
    await AsyncStorage.removeItem(SCHEMA_VERSION_KEY)
    console.log('[DB] Database reset successfully')
  } catch (error) {
    console.error('[DB] Error resetting database:', error)
    throw error
  }
}
