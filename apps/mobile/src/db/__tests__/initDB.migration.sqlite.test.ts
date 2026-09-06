import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { closeDatabase, initializeDatabase } from '../initDB'
import {
  SQL_SCHEMA,
  MIGRATION_V5_TOMBSTONE_INDEXES,
  MIGRATION_V7_REVIEW_EVENTS,
  MIGRATION_V9_REVIEW_DATE,
  MIGRATION_V9_LEARNING_COMMANDS,
} from '../schema'

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))
jest.mock('@/lib/sentry')

type Fault = 'column' | 'table' | 'backfill' | 'version' | null

// Execute the actual initializer and SQL on a disposable file, replacing only
// the Expo bridge and AsyncStorage. Closing/reopening uses a new SQLite handle.
describe('v8 to v9 migration recovery on file-backed SQLite', () => {
  let directory: string
  let db: DatabaseSync
  let version: string
  let fault: Fault
  let closeCount: number
  let wordsBefore: Record<string, SQLOutputValue>[]
  let eventsBefore: typeof wordsBefore

  const commands = () =>
    db.prepare('SELECT * FROM learning_commands ORDER BY sequence').all()
  const events = () =>
    db.prepare('SELECT * FROM review_events ORDER BY event_id').all()
  const words = () => db.prepare('SELECT * FROM words ORDER BY word_id').all()
  const interrupt = () => {
    fault = null
    throw new Error('Injected migration interruption')
  }
  const checkQueueTriggers = () => {
    const initial = commands()
    db.exec(`INSERT INTO review_events(event_id, user_id, word_id, assessment,
      review_mode, previous_interval_days, next_interval_days,
      previous_easiness_factor, next_easiness_factor, reviewed_at)
      VALUES ('new-event', 'qa-a', 'qa-a', 'good', 'recognition', 6, 15,
      2.5, 2.5, '2026-09-06T12:00:00Z')`)
    expect(commands().map(row => row.operation_id)).toEqual([
      'pending-a',
      'pending-b',
      'pending-c',
      'new-event',
    ])
    expect(commands()[3].sequence).toBeGreaterThan(Number(initial[2].sequence))
    db.exec(
      "UPDATE review_events SET sync_status = 'synced' WHERE event_id = 'new-event'"
    )
    expect(commands()).toEqual(initial)
    db.exec("DELETE FROM review_events WHERE event_id = 'pending-b'")
    expect(commands().map(row => row.operation_id)).toEqual([
      'pending-a',
      'pending-c',
    ])
    db.exec("UPDATE words SET deleted_at = '2026-09-06' WHERE word_id = 'qa-b'")
    expect(commands().map(row => row.operation_id)).toEqual(['pending-a'])
    expect(events().map(row => row.event_id)).toEqual([
      'error',
      'new-event',
      'pending-a',
      'synced',
    ])
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  }
  const checkPreserved = () => {
    expect(words()).toEqual(wordsBefore)
    expect(events()).toEqual(
      eventsBefore.map(event => ({ ...event, review_date: null }))
    )
    expect(commands().map(row => [row.operation_id, row.user_id])).toEqual([
      ['pending-a', 'qa-a'],
      ['pending-b', 'qa-a'],
      ['pending-c', 'qa-b'],
    ])
    expect(version).toBe('9')
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'woordenaar-migration-test-'))
    const file = join(directory, 'fixture.db')
    db = new DatabaseSync(file)
    // v8 has the current word columns, but neither review_date nor the v9 queue.
    db.exec(
      SQL_SCHEMA + MIGRATION_V5_TOMBSTONE_INDEXES + MIGRATION_V7_REVIEW_EVENTS
    )
    for (const user of ['qa-a', 'qa-b']) {
      db.prepare(
        `INSERT INTO words(word_id, user_id, dutch_lemma, translations,
        next_review_date, created_at, updated_at, interval_days, repetition_count,
        easiness_factor) VALUES (?, ?, ?, '{}', '2026-09-12', '2026-09-05',
        '2026-09-05', 7, 3, 2.35)`
      ).run(user, user, user)
    }
    for (const [id, user, status, at] of [
      ['pending-c', 'qa-b', 'pending', '2026-09-05T12:01:00Z'],
      ['pending-b', 'qa-a', 'pending', '2026-09-05T12:00:00Z'],
      ['pending-a', 'qa-a', 'pending', '2026-09-05T12:00:00Z'],
      ['synced', 'qa-a', 'synced', '2026-09-05T11:00:00Z'],
      ['error', 'qa-a', 'error', '2026-09-05T10:00:00Z'],
      ['conflict', 'qa-b', 'conflict', '2026-09-05T09:00:00Z'],
    ]) {
      db.prepare(
        `INSERT INTO review_events(event_id, user_id, word_id, assessment,
        review_mode, previous_interval_days, next_interval_days,
        previous_easiness_factor, next_easiness_factor, reviewed_at, sync_status)
        VALUES (?, ?, ?, 'good', 'recognition', 1, 6, 2.5, 2.5, ?, ?)`
      ).run(id, user, user, at, status)
    }
    wordsBefore = words()
    eventsBefore = events()
    db.close()
    version = '8'
    fault = null
    closeCount = 0
    jest.clearAllMocks()
    jest.mocked(AsyncStorage.getItem).mockImplementation(async () => version)
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (_, value) => {
      if (fault === 'version') interrupt()
      version = value
    })
    jest.mocked(SQLite.openDatabaseAsync).mockImplementation(async () => {
      db = new DatabaseSync(file)
      return {
        execAsync: async (sql: string) => {
          if (
            sql === MIGRATION_V9_LEARNING_COMMANDS &&
            (fault === 'table' || fault === 'backfill')
          ) {
            const boundary =
              fault === 'table' ? 'INSERT OR IGNORE' : 'CREATE TRIGGER'
            db.exec(sql.slice(0, sql.indexOf(boundary)))
            interrupt()
          }
          db.exec(sql)
          if (sql === MIGRATION_V9_REVIEW_DATE && fault === 'column')
            interrupt()
        },
        closeAsync: async () => {
          db.close()
          closeCount += 1
        },
      } as unknown as SQLite.SQLiteDatabase
    })
  })

  afterEach(async () => {
    await closeDatabase()
    // Only the freshly generated fixture directory is removed; never an app DB.
    rmSync(directory, { recursive: true, force: true })
  })

  it('migrates pending events once, preserving SRS, identities and non-pending history', async () => {
    await initializeDatabase()
    checkPreserved()
    const before = commands()
    await closeDatabase()
    await initializeDatabase()
    checkPreserved()
    expect(commands()).toEqual(before)
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(2)
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1)
    checkQueueTriggers()
  })

  it.each(['column', 'table', 'backfill', 'version'] as const)(
    'retries after interruption at %s without losing or duplicating commands',
    async phase => {
      fault = phase
      await expect(initializeDatabase()).rejects.toThrow(
        'Injected migration interruption'
      )
      expect(version).toBe('8')
      expect(closeCount).toBe(1)
      await initializeDatabase()
      checkPreserved()
      const before = commands()
      await closeDatabase()
      await initializeDatabase()
      expect(commands()).toEqual(before)
      expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(3)
      checkQueueTriggers()
    }
  )

  it('shares the migration between concurrent initializers on one connection', async () => {
    const [first, second] = await Promise.all([
      initializeDatabase(),
      initializeDatabase(),
    ])
    expect(first).toBe(second)
    checkPreserved()
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1)
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1)
  })
})
