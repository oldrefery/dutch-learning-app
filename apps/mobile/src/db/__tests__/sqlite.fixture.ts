import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { getDatabase } from '../initDB'
import {
  MIGRATION_V10_REVIEW_CORRECTIONS,
  MIGRATION_V11_CORRECTION_RESOLUTION,
} from '../reviewCorrectionSchema'
import {
  SQL_SCHEMA,
  MIGRATION_V5_TOMBSTONE_INDEXES,
  MIGRATION_V7_REVIEW_EVENTS,
  MIGRATION_V9_LEARNING_COMMANDS,
  MIGRATION_V9_REVIEW_DATE,
} from '../schema'

// Only the native Expo bridge is replaced; execute actual repository SQL.
export const createTestDatabase = (path = ':memory:', initialize = true) => {
  const database = new DatabaseSync(path)
  if (initialize) {
    database.exec(SQL_SCHEMA)
    database.exec(MIGRATION_V5_TOMBSTONE_INDEXES)
    database.exec(MIGRATION_V7_REVIEW_EVENTS)
    database.exec(MIGRATION_V9_REVIEW_DATE)
    database.exec(MIGRATION_V9_LEARNING_COMMANDS)
    database.exec(MIGRATION_V10_REVIEW_CORRECTIONS)
    database.exec(MIGRATION_V11_CORRECTION_RESOLUTION)
  }
  const runAsync = async (sql: string, ...values: SQLInputValue[]) =>
    database.prepare(sql).run(...values)
  const getFirstAsync = async (sql: string, values: SQLInputValue[]) =>
    database.prepare(sql).get(...values) ?? null
  const adapter = {
    getAllAsync: async (sql: string, ...values: SQLInputValue[]) =>
      database.prepare(sql).all(...values),
    getFirstAsync,
    prepareAsync: async (sql: string) => {
      const statement = database.prepare(sql)
      return {
        executeAsync: async (...values: SQLInputValue[]) => {
          const rows = statement.all(...values)
          return {
            getFirstAsync: async () => rows[0] ?? null,
            getAllAsync: async () => rows,
          }
        },
        finalizeAsync: async () => {},
      }
    },
    runAsync,
    withExclusiveTransactionAsync: async (
      callback: (transaction: {
        runAsync: typeof runAsync
        getFirstAsync: typeof getFirstAsync
      }) => Promise<void>
    ) => {
      database.exec('BEGIN')
      try {
        await callback(adapter)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  }
  jest
    .mocked(getDatabase)
    .mockResolvedValue(
      adapter as unknown as Awaited<ReturnType<typeof getDatabase>>
    )
  return database
}
