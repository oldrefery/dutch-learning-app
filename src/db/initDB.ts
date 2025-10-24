import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SQL_SCHEMA } from './schema'

const DB_NAME = 'dutch_learning.db'
const SCHEMA_VERSION_KEY = 'db_schema_version'
const SCHEMA_VERSION = 2

let database: SQLite.SQLiteDatabase | null = null

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    return database
  }

  try {
    database = await SQLite.openDatabaseAsync(DB_NAME)

    // Check schema version
    const existingVersion = await AsyncStorage.getItem(SCHEMA_VERSION_KEY)
    const currentVersion = parseInt(existingVersion || '0', 10)

    if (currentVersion < SCHEMA_VERSION) {
      // Execute schema creation
      const statements = SQL_SCHEMA.split(';').filter(stmt => stmt.trim())
      for (const statement of statements) {
        if (statement.trim()) {
          await database.execAsync(statement)
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
