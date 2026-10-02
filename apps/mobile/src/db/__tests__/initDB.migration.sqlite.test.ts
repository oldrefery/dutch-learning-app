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
import { MIGRATION_V11_CORRECTION_RESOLUTION } from '../reviewCorrectionSchema'
import { MIGRATION_V12_CORRECTION_RECOVERY } from '../reviewCorrectionRecoverySchema'
import { MIGRATION_V13_DICTIONARY_CONTENT } from '../dictionaryContentSchema'
import {
  MIGRATION_V14_DICTIONARY_IMPORTS,
  MIGRATION_V15_DICTIONARY_IMPORT_RECEIPTS,
} from '../dictionaryImportSchema'

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))
jest.mock('@/lib/sentry')

const IMPORT_RECEIPTS_FAULT = 'import-receipts'
const SELECT_IMPORTS = 'SELECT * FROM dictionary_import_intents'
const CHECK_FOREIGN_KEYS = 'PRAGMA foreign_key_check'

type Fault =
  | 'column'
  | 'table'
  | 'backfill'
  | 'version'
  | 'corrections'
  | 'resolution'
  | 'recovery'
  | 'dictionary'
  | 'imports'
  | typeof IMPORT_RECEIPTS_FAULT
  | null

// Execute the actual initializer and SQL on a disposable file, replacing only
// the Expo bridge and AsyncStorage. Closing/reopening uses a new SQLite handle.
describe('v8 to current migration recovery on file-backed SQLite', () => {
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
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
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
    expect(version).toBe('15')
    expect(
      db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name LIKE 'dictionary_%'
           ORDER BY name`
        )
        .all()
        .map(row => row.name)
    ).toEqual([
      'dictionary_card_content',
      'dictionary_card_refresh_queue',
      'dictionary_cefr_assessment_cache',
      'dictionary_cefr_head_cache',
      'dictionary_change_cursors',
      'dictionary_content_commands',
      'dictionary_import_acknowledgements',
      'dictionary_import_intents',
      'dictionary_personal_refresh_queue',
      'dictionary_revision_cache',
    ])
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
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
    db.prepare(
      `INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at, deleted_at, sync_status,
      last_sync_attempt_at)
      VALUES ('tombstone-a', 'qa-a', 'verwijderd', '{}', '2026-09-12',
      '2026-09-05', '2026-09-06', '2026-09-06', 'deleted', '2026-09-06')`
    ).run()
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
        withExclusiveTransactionAsync: async (
          callback: (tx: {
            execAsync: (sql: string) => Promise<void>
          }) => Promise<void>
        ) => {
          db.exec('BEGIN')
          try {
            await callback({
              execAsync: async (sql: string) => {
                if (fault === 'corrections') {
                  db.exec(
                    sql.slice(0, sql.indexOf('DROP TABLE learning_commands;'))
                  )
                  interrupt()
                }
                db.exec(sql)
                if (
                  sql === MIGRATION_V15_DICTIONARY_IMPORT_RECEIPTS &&
                  fault === IMPORT_RECEIPTS_FAULT
                )
                  interrupt()
                if (
                  sql === MIGRATION_V14_DICTIONARY_IMPORTS &&
                  fault === 'imports'
                )
                  interrupt()
                if (
                  sql === MIGRATION_V12_CORRECTION_RECOVERY &&
                  fault === 'recovery'
                )
                  interrupt()
                if (
                  sql === MIGRATION_V13_DICTIONARY_CONTENT &&
                  fault === 'dictionary'
                ) {
                  db.exec(
                    sql.slice(
                      0,
                      sql.indexOf(
                        'CREATE TABLE IF NOT EXISTS dictionary_content_commands'
                      )
                    )
                  )
                  interrupt()
                }
              },
            })
            db.exec('COMMIT')
          } catch (error) {
            db.exec('ROLLBACK')
            throw error
          }
        },
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
          if (
            sql === MIGRATION_V11_CORRECTION_RESOLUTION &&
            fault === 'resolution'
          )
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

  it.each([
    'column',
    'table',
    'backfill',
    'version',
    'corrections',
    'resolution',
    'recovery',
    'dictionary',
    'imports',
    IMPORT_RECEIPTS_FAULT,
  ] as const)(
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

  it('adds the v11 marker without rewriting existing corrections, words, or queue sequences', async () => {
    await initializeDatabase()
    db.exec(`ALTER TABLE review_corrections DROP COLUMN resolved_at;
      INSERT INTO review_corrections(correction_id, event_id, word_id, user_id,
        expected_revision, assessment, queued_at, status)
      VALUES ('edit', 'pending-a', 'qa-a', 'qa-a', 0, 'hard', '2026-09-06', 'pending');
      UPDATE review_corrections SET status = 'conflict', error = 'Conflict';`)
    const queue = commands()
    const history = events()
    const corrections = db.prepare('SELECT * FROM review_corrections').all()
    version = '10'
    await closeDatabase()
    await initializeDatabase()
    expect(version).toBe('15')
    expect(words()).toEqual(wordsBefore)
    expect(events()).toEqual(history)
    expect(commands()).toEqual(queue)
    expect(db.prepare('SELECT * FROM review_corrections').all()).toEqual(
      corrections.map(row => ({ ...row, resolved_at: null }))
    )
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })

  it('adds v13 without changing words, tombstones, learning commands or corrections', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO learning_commands(
        operation_id, kind, user_id, word_id, reset_at, review_date
      ) VALUES ('reset-keep', 'reset', 'qa-b', 'qa-b',
        '2026-09-06T13:00:00Z', '2026-09-06');
      INSERT INTO review_corrections(
        correction_id, event_id, word_id, user_id, expected_revision,
        assessment, queued_at, status
      ) VALUES ('correction-keep', 'pending-a', 'qa-a', 'qa-a', 0,
        'hard', '2026-09-06T14:00:00Z', 'pending');`)
    const wordSnapshot = words()
    const eventSnapshot = events()
    const commandSnapshot = commands()
    const correctionSnapshot = db
      .prepare('SELECT * FROM review_corrections ORDER BY correction_id')
      .all()
    const recoverySnapshot = db
      .prepare(
        'SELECT * FROM review_correction_recovery ORDER BY correction_id'
      )
      .all()
    db.exec(`DROP TABLE dictionary_change_cursors;
      DROP TABLE dictionary_content_commands;
      DROP TABLE dictionary_card_content;
      DROP TABLE dictionary_cefr_head_cache;
      DROP TABLE dictionary_cefr_assessment_cache;
      DROP TABLE dictionary_revision_cache;`)
    version = '12'
    await closeDatabase()

    await initializeDatabase()

    expect(version).toBe('15')
    expect(words()).toEqual(wordSnapshot)
    expect(events()).toEqual(eventSnapshot)
    expect(commands()).toEqual(commandSnapshot)
    expect(
      db
        .prepare('SELECT * FROM review_corrections ORDER BY correction_id')
        .all()
    ).toEqual(correctionSnapshot)
    expect(
      db
        .prepare(
          'SELECT * FROM review_correction_recovery ORDER BY correction_id'
        )
        .all()
    ).toEqual(recoverySnapshot)
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })

  it('upgrades v14 receipt provenance without changing pending imports or prior queues', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_import_intents(operation_id,user_id,word_id,payload_json,queued_at)
      VALUES ('pending-import','qa-a','qa-a','{}','2026-10-02');
      INSERT INTO dictionary_personal_refresh_queue(word_id,user_id) VALUES ('qa-a','qa-a');
      DROP TABLE dictionary_import_acknowledgements;`)
    const beforeWords = words()
    const beforeCommands = commands()
    const beforeImports = db.prepare(SELECT_IMPORTS).all()
    const beforeRefresh = db
      .prepare('SELECT * FROM dictionary_personal_refresh_queue')
      .all()
    version = '14'
    await closeDatabase()
    fault = IMPORT_RECEIPTS_FAULT
    await expect(initializeDatabase()).rejects.toThrow()
    expect(version).toBe('14')
    fault = null
    await initializeDatabase()
    expect(version).toBe('15')
    expect(words()).toEqual(beforeWords)
    expect(commands()).toEqual(beforeCommands)
    expect(db.prepare(SELECT_IMPORTS).all()).toEqual(beforeImports)
    expect(
      db.prepare('SELECT * FROM dictionary_personal_refresh_queue').all()
    ).toEqual(beforeRefresh)
    expect(
      db.prepare('SELECT * FROM dictionary_import_acknowledgements').all()
    ).toEqual([])
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })

  it('adds v14 without changing v13 cards, tombstones or content/learning queues', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_card_content(word_id,user_id,content_version,
      fallback_content_json,overrides_json,updated_at)
      VALUES ('qa-a','qa-a',1,'{}','{}','2026-10-02');
      INSERT INTO dictionary_content_commands(operation_id,user_id,word_id,kind,
        expected_content_version,payload_json,status,queued_at)
      VALUES ('preserved-private','qa-a','qa-a','create-private',0,'{}','error','2026-10-02');
      DROP TABLE dictionary_import_intents;`)
    const oldWords = words()
    const oldLearning = commands()
    const oldCards = db.prepare('SELECT * FROM dictionary_card_content').all()
    const oldContent = db
      .prepare('SELECT * FROM dictionary_content_commands')
      .all()
    version = '13'
    await closeDatabase()
    await initializeDatabase()
    expect(version).toBe('15')
    expect(words()).toEqual(oldWords)
    expect(commands()).toEqual(oldLearning)
    expect(db.prepare('SELECT * FROM dictionary_card_content').all()).toEqual(
      oldCards
    )
    expect(
      db.prepare('SELECT * FROM dictionary_content_commands').all()
    ).toEqual(oldContent)
    expect(db.prepare(SELECT_IMPORTS).all()).toEqual([])
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })
})
