import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  MIGRATION_V3_UNIQUE_INDEX,
  MIGRATION_V4_ADD_REGISTER,
  MIGRATION_V5_ADD_PROGRESS_DELETED_AT,
  MIGRATION_V5_ADD_WORD_DELETED_AT,
  MIGRATION_V5_TOMBSTONE_INDEXES,
  MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS,
  MIGRATION_V7_REVIEW_EVENTS,
  MIGRATION_V8_ADD_USAGE_NOTES,
} from '../schema'
import { closeDatabase, initializeDatabase } from '../initDB'

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

describe('initializeDatabase', () => {
  const mockDatabase = {
    execAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
    closeAsync: jest.fn(),
  }
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockDatabase.execAsync.mockResolvedValue(undefined)
    mockDatabase.getAllAsync.mockResolvedValue([])
    mockDatabase.runAsync.mockResolvedValue(undefined)
    mockDatabase.closeAsync.mockResolvedValue(undefined)
    ;(SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDatabase)
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('8')
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    await closeDatabase()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('opens an initialized database without rerunning migrations', async () => {
    const result = await initializeDatabase()

    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('dutch_learning.db', {
      useNewConnection: true,
    })
    expect(result).toBe(mockDatabase)
    expect(mockDatabase.execAsync).toHaveBeenCalledTimes(1)
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      'PRAGMA foreign_keys = ON'
    )
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
  })

  it('shares one in-flight initialization across concurrent callers', async () => {
    let resolveVersion: (version: string) => void = () => {}
    ;(AsyncStorage.getItem as jest.Mock).mockReturnValue(
      new Promise<string>(resolve => {
        resolveVersion = resolve
      })
    )

    const firstInitialization = initializeDatabase()
    const secondInitialization = initializeDatabase()
    resolveVersion('7')
    const [firstResult, secondResult] = await Promise.all([
      firstInitialization,
      secondInitialization,
    ])

    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1)
    expect(firstResult).toBe(mockDatabase)
    expect(secondResult).toBe(mockDatabase)
  })

  it('applies the complete migration chain for a fresh database', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)

    await initializeDatabase()

    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS collections')
    )
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V3_UNIQUE_INDEX
    )
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V4_ADD_REGISTER
    )
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V5_ADD_WORD_DELETED_AT
    )
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V5_ADD_PROGRESS_DELETED_AT
    )
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V5_TOMBSTONE_INDEXES
    )
    for (const column of MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS) {
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(column.migration)
    }
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V7_REVIEW_EVENTS
    )
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V8_ADD_USAGE_NOTES
    )
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('db_schema_version', '8')
  })

  it('treats a malformed stored version as a fresh database', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-a-version')

    await initializeDatabase()

    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS collections')
    )
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V3_UNIQUE_INDEX
    )
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('db_schema_version', '8')
  })

  it('continues when an idempotent column migration finds the column', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('3')
    mockDatabase.execAsync.mockImplementation(async migration => {
      if (migration === MIGRATION_V4_ADD_REGISTER) {
        throw new Error('duplicate column name: register')
      }
    })

    await initializeDatabase()

    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      MIGRATION_V5_TOMBSTONE_INDEXES
    )
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('db_schema_version', '8')
  })

  it('discards a failed connection so initialization can retry', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('3')
    mockDatabase.execAsync.mockRejectedValue(new Error('disk I/O error'))

    await expect(initializeDatabase()).rejects.toThrow(
      'Failed to initialize database: disk I/O error'
    )

    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    expect(mockDatabase.closeAsync).toHaveBeenCalledTimes(1)

    mockDatabase.execAsync.mockResolvedValue(undefined)
    await initializeDatabase()

    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(2)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('db_schema_version', '8')
  })
})
