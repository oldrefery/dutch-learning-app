import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  SQL_SCHEMA,
  MIGRATION_V3_UNIQUE_INDEX,
  MIGRATION_V4_ADD_REGISTER,
  MIGRATION_V5_ADD_PROGRESS_DELETED_AT,
  MIGRATION_V5_ADD_WORD_DELETED_AT,
  MIGRATION_V5_TOMBSTONE_INDEXES,
  MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS,
  MIGRATION_V7_REVIEW_EVENTS,
  MIGRATION_V8_ADD_USAGE_NOTES,
} from './schema'
import { Sentry } from '@/lib/sentry'

const DB_NAME = 'dutch_learning.db'
const SCHEMA_VERSION_KEY = 'db_schema_version'
const SCHEMA_VERSION = 8

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
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null

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

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  migration: string,
  columnName: string
): Promise<void> {
  try {
    await db.execAsync(migration)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('duplicate column name')) {
      throw error
    }
    console.log(`[DB] ${columnName} column already exists, skipping migration`)
  }
}

async function migrateToV5(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DB] Starting migration to v5: adding delete tombstones...')
  await addColumnIfMissing(
    db,
    MIGRATION_V5_ADD_WORD_DELETED_AT,
    'words.deleted_at'
  )
  await addColumnIfMissing(
    db,
    MIGRATION_V5_ADD_PROGRESS_DELETED_AT,
    'user_progress.deleted_at'
  )
  await db.execAsync(MIGRATION_V5_TOMBSTONE_INDEXES)
  console.log('[DB] Migration to v5 completed successfully')
}

async function migrateToV6(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DB] Starting migration to v6: adding sync timestamps...')
  for (const column of MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS) {
    await addColumnIfMissing(db, column.migration, column.columnName)
  }
  console.log('[DB] Migration to v6 completed successfully')
}

async function migrateToV7(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DB] Starting migration to v7: adding review events...')
  await db.execAsync(MIGRATION_V7_REVIEW_EVENTS)
  console.log('[DB] Migration to v7 completed successfully')
}

async function migrateToV8(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DB] Starting migration to v8: adding usage notes...')
  await addColumnIfMissing(
    db,
    MIGRATION_V8_ADD_USAGE_NOTES,
    'words.usage_notes'
  )
  console.log('[DB] Migration to v8 completed successfully')
}

async function createBaseSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const statements = SQL_SCHEMA.split(';').filter(statement => statement.trim())
  for (const statement of statements) {
    await db.execAsync(statement)
  }
  console.log('[DB] Base schema created (v2)')
}

async function migrateToV4(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DB] Starting migration to v4: adding register column...')
  await addColumnIfMissing(db, MIGRATION_V4_ADD_REGISTER, 'words.register')
  console.log('[DB] Migration to v4 completed successfully')
}

async function applyPendingMigrations(
  db: SQLite.SQLiteDatabase,
  currentVersion: number
): Promise<void> {
  if (currentVersion < 2) {
    await createBaseSchema(db)
  }
  if (currentVersion < 3) {
    await migrateToV3(db)
  }
  if (currentVersion < 4) {
    await migrateToV4(db)
  }
  if (currentVersion < 5) {
    await migrateToV5(db)
  }
  if (currentVersion < 6) {
    await migrateToV6(db)
  }
  if (currentVersion < 7) {
    await migrateToV7(db)
  }
  if (currentVersion < 8) {
    await migrateToV8(db)
  }
}

function parseSchemaVersion(storedVersion: string | null): number {
  const parsedVersion = Number.parseInt(storedVersion ?? '', 10)
  return Number.isInteger(parsedVersion) && parsedVersion >= 0
    ? parsedVersion
    : 0
}

async function ensureCurrentSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingVersion = await AsyncStorage.getItem(SCHEMA_VERSION_KEY)
  const currentVersion = parseSchemaVersion(existingVersion)

  if (currentVersion >= SCHEMA_VERSION) {
    console.log('[DB] Database already initialized')
    return
  }

  await applyPendingMigrations(db, currentVersion)
  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, SCHEMA_VERSION.toString())
  console.log('[DB] Database initialized with schema version', SCHEMA_VERSION)
}

async function discardFailedDatabase(
  failedDatabase: SQLite.SQLiteDatabase | null
): Promise<void> {
  try {
    await failedDatabase?.closeAsync()
  } catch (error) {
    console.error('[DB] Error closing failed database connection:', error)
  }
}

async function openAndInitializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  let openedDatabase: SQLite.SQLiteDatabase | null = null
  try {
    openedDatabase = await SQLite.openDatabaseAsync(DB_NAME, {
      useNewConnection: true,
    })
    await openedDatabase.execAsync('PRAGMA foreign_keys = ON')
    await ensureCurrentSchema(openedDatabase)
    database = openedDatabase
    return openedDatabase
  } catch (error) {
    console.error('[DB] Error initializing database:', error)
    await discardFailedDatabase(openedDatabase)
    throw new Error(
      `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    return database
  }

  initializationPromise ??= openAndInitializeDatabase()
  const pendingInitialization = initializationPromise
  try {
    return await pendingInitialization
  } finally {
    if (initializationPromise === pendingInitialization) {
      initializationPromise = null
    }
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
      'DROP TABLE IF EXISTS review_events',
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
