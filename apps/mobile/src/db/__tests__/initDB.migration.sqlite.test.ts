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
import { MIGRATION_V20_DICTIONARY_FOLLOWING_IMPORTS } from '../dictionaryFollowingImportSchema'
import { MIGRATION_V21_DICTIONARY_FOLLOWING_TRANSFERS } from '../dictionaryFollowingTransferSchema'
import { MIGRATION_V22_DICTIONARY_CREATION } from '../dictionaryCreationSchema'
import { MIGRATION_V23_DICTIONARY_MODE_RECONCILIATION } from '../dictionaryModeReconciliationSchema'
import { MIGRATION_V16_DICTIONARY_IMPORT_RECOVERY } from '../dictionaryImportRecoverySchema'
import { MIGRATION_V17_DICTIONARY_FOLLOWING } from '../dictionaryFollowingSchema'
import {
  MIGRATION_V18_DICTIONARY_ANALYSIS,
  MIGRATION_V19_DICTIONARY_ANALYSIS_HISTORY,
} from '../dictionaryAnalysisSchema'

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))
jest.mock('@/lib/sentry')

const FOLLOWING_TRANSFERS_FAULT = 'following-transfers'
const FOLLOWING_IMPORTS_FAULT = 'following-imports'
const IMPORT_RECOVERY_FAULT = 'import-recovery'
const MIGRATION_INTERRUPTION = 'Injected migration interruption'
const IMPORT_RECEIPTS_FAULT = 'import-receipts'
const SELECT_IMPORTS = 'SELECT * FROM dictionary_import_intents'
const SELECT_DELIVERY = 'SELECT * FROM dictionary_import_delivery'
const SELECT_ANALYSIS = 'SELECT * FROM dictionary_analysis_client_operations'
const FIXTURE_FILE = 'fixture.db'
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
  | 'following'
  | 'analysis'
  | 'analysis-history'
  | 'creation'
  | 'mode-reconciliation'
  | typeof FOLLOWING_TRANSFERS_FAULT
  | typeof FOLLOWING_IMPORTS_FAULT
  | typeof IMPORT_RECOVERY_FAULT
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
    throw new Error(MIGRATION_INTERRUPTION)
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
    expect(version).toBe('23')
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
      'dictionary_analysis_client_history',
      'dictionary_analysis_client_operations',
      'dictionary_card_content',
      'dictionary_card_refresh_queue',
      'dictionary_cefr_assessment_cache',
      'dictionary_cefr_head_cache',
      'dictionary_change_cursors',
      'dictionary_content_commands',
      'dictionary_creation_client_journal',
      'dictionary_effective_card_cache',
      'dictionary_following_cursors',
      'dictionary_following_heads',
      'dictionary_following_import_journal',
      'dictionary_following_refresh_queue',
      'dictionary_following_transfer_sessions',
      'dictionary_import_acknowledgements',
      'dictionary_import_delivery',
      'dictionary_import_intents',
      'dictionary_import_recovery_outbox',
      'dictionary_mode_reconciliation_requests',
      'dictionary_mode_reconciliations',
      'dictionary_personal_refresh_queue',
      'dictionary_revision_cache',
    ])
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'woordenaar-migration-test-'))
    const file = join(directory, FIXTURE_FILE)
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
                const migrationFaults = new Map<string, Fault>([
                  [MIGRATION_V22_DICTIONARY_CREATION, 'creation'],
                  [
                    MIGRATION_V23_DICTIONARY_MODE_RECONCILIATION,
                    'mode-reconciliation',
                  ],
                  [
                    MIGRATION_V21_DICTIONARY_FOLLOWING_TRANSFERS,
                    FOLLOWING_TRANSFERS_FAULT,
                  ],
                  [
                    MIGRATION_V20_DICTIONARY_FOLLOWING_IMPORTS,
                    FOLLOWING_IMPORTS_FAULT,
                  ],
                  [
                    MIGRATION_V19_DICTIONARY_ANALYSIS_HISTORY,
                    'analysis-history',
                  ],
                  [MIGRATION_V18_DICTIONARY_ANALYSIS, 'analysis'],
                  [MIGRATION_V17_DICTIONARY_FOLLOWING, 'following'],
                  [
                    MIGRATION_V16_DICTIONARY_IMPORT_RECOVERY,
                    IMPORT_RECOVERY_FAULT,
                  ],
                  [
                    MIGRATION_V15_DICTIONARY_IMPORT_RECEIPTS,
                    IMPORT_RECEIPTS_FAULT,
                  ],
                  [MIGRATION_V14_DICTIONARY_IMPORTS, 'imports'],
                  [MIGRATION_V12_CORRECTION_RECOVERY, 'recovery'],
                ])
                if (fault && migrationFaults.get(sql) === fault) interrupt()
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
    'following',
    'analysis',
    IMPORT_RECEIPTS_FAULT,
    IMPORT_RECOVERY_FAULT,
    FOLLOWING_IMPORTS_FAULT,
    FOLLOWING_TRANSFERS_FAULT,
  ] as const)(
    'retries after interruption at %s without losing or duplicating commands',
    async phase => {
      fault = phase
      await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
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

  it('retries the additive v18 journal upgrade without changing v17 content, learning or recovery queues', async () => {
    await initializeDatabase()
    const preservedTables = [
      'words',
      'review_events',
      'learning_commands',
      'review_corrections',
      'dictionary_import_intents',
      'dictionary_content_commands',
      'dictionary_creation_client_journal',
      'dictionary_effective_card_cache',
      'dictionary_following_refresh_queue',
      'dictionary_following_transfer_sessions',
      'dictionary_following_cursors',
    ]
    const snapshots = preservedTables.map(table =>
      db.prepare(`SELECT * FROM ${table}`).all()
    )
    db.exec('DROP TABLE dictionary_analysis_client_operations')
    version = '17'
    await closeDatabase()
    fault = 'analysis'
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    expect(version).toBe('17')
    await initializeDatabase()
    expect(version).toBe('23')
    expect(
      preservedTables.map(table => db.prepare(`SELECT * FROM ${table}`).all())
    ).toEqual(snapshots)
    expect(db.prepare(SELECT_ANALYSIS).all()).toEqual([])
    db.exec(`INSERT INTO dictionary_analysis_client_operations(user_id,word_id,operation_id,operation_json)
      VALUES ('qa-a','qa-a','reserved-operation','{}')`)
    version = '17'
    await closeDatabase()
    await initializeDatabase()
    expect(
      db
        .prepare(
          'SELECT operation_id FROM dictionary_analysis_client_operations'
        )
        .all()
    ).toEqual([{ operation_id: 'reserved-operation' }])
  })

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

  it('retries v20 without rewriting unresolved v1 import/analysis IDs or personal learning', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_import_delivery(word_id,user_id,original_intent_json)
      VALUES ('qa-a','qa-a','{"protocol_version":1,"operation_id":"reserved-original"}');
      INSERT INTO dictionary_analysis_client_operations(user_id,word_id,operation_id,operation_json)
      VALUES ('qa-a','qa-a','reserved-analysis','{"submitted":true,"response":null}');
      DROP TABLE dictionary_following_import_journal;`)
    const imports = db.prepare(SELECT_DELIVERY).all()
    const analysis = db.prepare(SELECT_ANALYSIS).all()
    const personal = words()
    const learning = commands()
    version = '19'
    await closeDatabase()
    fault = FOLLOWING_IMPORTS_FAULT
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    expect(version).toBe('19')
    const inspected = new DatabaseSync(join(directory, FIXTURE_FILE))
    try {
      expect(
        inspected
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'dictionary_following_import_journal'"
          )
          .all()
      ).toEqual([])
      expect(inspected.prepare(SELECT_DELIVERY).all()).toEqual(imports)
      expect(inspected.prepare(SELECT_ANALYSIS).all()).toEqual(analysis)
    } finally {
      inspected.close()
    }
    await initializeDatabase()
    expect(version).toBe('23')
    expect(db.prepare(SELECT_DELIVERY).all()).toEqual(imports)
    expect(db.prepare(SELECT_ANALYSIS).all()).toEqual(analysis)
    expect(words()).toEqual(personal)
    expect(commands()).toEqual(learning)
  })

  it('retries v19 atomically while preserving a reserved v18 operation and all personal data', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_analysis_client_operations(user_id,word_id,operation_id,operation_json)
      VALUES ('qa-a','qa-a','unresolved-operation','{"submitted":true,"response":null}')`)
    const operations = db.prepare(SELECT_ANALYSIS).all()
    const personal = words()
    const learning = commands()
    db.exec('DROP TABLE dictionary_analysis_client_history')
    version = '18'
    await closeDatabase()
    fault = 'analysis-history'
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    expect(version).toBe('18')
    const inspected = new DatabaseSync(join(directory, FIXTURE_FILE))
    try {
      expect(
        inspected
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'dictionary_analysis_client_history'"
          )
          .all()
      ).toEqual([])
      expect(inspected.prepare(SELECT_ANALYSIS).all()).toEqual(operations)
    } finally {
      inspected.close()
    }
    await initializeDatabase()
    expect(version).toBe('23')
    expect(db.prepare(SELECT_ANALYSIS).all()).toEqual(operations)
    expect(
      db.prepare('SELECT * FROM dictionary_analysis_client_history').all()
    ).toEqual([])
    expect(words()).toEqual(personal)
    expect(commands()).toEqual(learning)
    await closeDatabase()
    await initializeDatabase()
    expect(db.prepare(SELECT_ANALYSIS).all()).toEqual(operations)
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
    expect(version).toBe('23')
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

    expect(version).toBe('23')
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
    expect(version).toBe('23')
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

  it('retries interrupted v15-to-v16 backfill without inventing provenance or placement delivery', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_import_intents(operation_id,user_id,word_id,payload_json,queued_at)
      VALUES ('pending-origin','qa-a','qa-a','{"word_id":"qa-a"}','2026-10-02');
      INSERT INTO dictionary_import_acknowledgements(word_id,user_id) VALUES ('qa-b','qa-b');
      DROP TABLE dictionary_import_recovery_outbox; DROP TABLE dictionary_import_delivery;`)
    const beforeWords = words()
    const beforeCommands = commands()
    const beforeImports = db.prepare(SELECT_IMPORTS).all()
    version = '15'
    await closeDatabase()
    fault = IMPORT_RECOVERY_FAULT
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    expect(version).toBe('15')
    const inspected = new DatabaseSync(join(directory, FIXTURE_FILE))
    try {
      expect(
        inspected
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'dictionary_import_delivery'"
          )
          .all()
      ).toEqual([])
    } finally {
      inspected.close()
    }
    await initializeDatabase()
    expect(version).toBe('23')
    expect(words()).toEqual(beforeWords)
    expect(commands()).toEqual(beforeCommands)
    expect(db.prepare(SELECT_IMPORTS).all()).toEqual(beforeImports)
    expect(
      db
        .prepare('SELECT * FROM dictionary_import_delivery WHERE word_id = ?')
        .get('qa-a')
    ).toMatchObject({
      original_intent_json: '{"word_id":"qa-a"}',
      acknowledged_placement_revision: null,
    })
    expect(
      db
        .prepare('SELECT * FROM dictionary_import_delivery WHERE word_id = ?')
        .get('qa-b')
    ).toMatchObject({
      original_intent_json: null,
      recovery_version: null,
      acknowledged_placement_revision: null,
    })
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })

  it('retries v16-to-v17 without rewriting v1 cards, decimalizing old cursors or consuming queues', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_card_content(word_id,user_id,content_version,
        fallback_content_json,overrides_json,updated_at)
        VALUES ('qa-a','qa-a',1,'{}','{}','2026-10-10');
      INSERT INTO dictionary_content_commands(operation_id,user_id,word_id,kind,
        expected_content_version,payload_json,status,queued_at)
        VALUES ('pending-private','qa-a','qa-a','edit-private',1,'{}','error','2026-10-10');
      INSERT INTO dictionary_change_cursors(user_id,committed_version,updated_at)
        VALUES ('qa-a',9007199254740991,'2026-10-10');
      INSERT INTO dictionary_card_refresh_queue(word_id,user_id) VALUES ('qa-a','qa-a');
      DROP TABLE dictionary_following_refresh_queue;
      DROP TABLE dictionary_following_cursors;
      DROP TABLE dictionary_effective_card_cache;
      DROP TABLE dictionary_following_heads;`)
    const names = [
      'words',
      'review_events',
      'learning_commands',
      'dictionary_card_content',
      'dictionary_content_commands',
      'dictionary_creation_client_journal',
      'dictionary_change_cursors',
      'dictionary_card_refresh_queue',
    ]
    const before = names.map(name => db.prepare(`SELECT * FROM ${name}`).all())
    version = '16'
    await closeDatabase()
    fault = 'following'
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    expect(version).toBe('16')
    await initializeDatabase()
    expect(version).toBe('23')
    expect(
      names.map(name => db.prepare(`SELECT * FROM ${name}`).all())
    ).toEqual(before)
    for (const name of [
      'dictionary_effective_card_cache',
      'dictionary_following_cursors',
      'dictionary_following_refresh_queue',
      'dictionary_following_transfer_sessions',
      'dictionary_following_heads',
      'dictionary_following_import_journal',
    ])
      expect(db.prepare(`SELECT * FROM ${name}`).all()).toEqual([])
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })

  it('rolls back and retries v23 from v22 without losing originals or learning', async () => {
    await initializeDatabase()
    const beforeWords = words()
    const beforeCommands = commands()
    db.exec(
      'DROP TABLE dictionary_mode_reconciliation_requests; DROP TABLE dictionary_mode_reconciliations'
    )
    await closeDatabase()
    version = '22'
    fault = 'mode-reconciliation'
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    const proof = new DatabaseSync(join(directory, FIXTURE_FILE))
    expect(
      proof
        .prepare(
          "SELECT name FROM sqlite_master WHERE name LIKE 'dictionary_mode_%'"
        )
        .all()
    ).toEqual([])
    proof.close()
    expect(version).toBe('22')
    await initializeDatabase()
    expect(version).toBe('23')
    expect(words()).toEqual(beforeWords)
    expect(commands()).toEqual(beforeCommands)
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })

  it('rolls back and retries v22 from v21 without changing personal learning or prior journals', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_following_transfer_sessions(user_id,session_id,payload_json) VALUES ('qa-a','retained-transfer','{"submitted":true}');
      INSERT INTO dictionary_following_import_journal(user_id,operation_id,word_id,payload_json) VALUES ('qa-a','retained-import','qa-a','{"submitted":true}');`)
    const oldWords = words()
    const oldEvents = events()
    const oldLearning = commands()
    const priorTables = [
      'dictionary_following_transfer_sessions',
      'dictionary_following_import_journal',
      'dictionary_analysis_client_operations',
      'dictionary_card_content',
    ]
    const oldRows = priorTables.map(name =>
      db.prepare(`SELECT * FROM ${name}`).all()
    )
    db.exec('DROP TABLE dictionary_creation_client_journal')
    version = '21'
    fault = 'creation'
    jest.mocked(AsyncStorage.setItem).mockClear()
    await closeDatabase()
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    expect(version).toBe('21')
    const proof = new DatabaseSync(join(directory, FIXTURE_FILE))
    expect(
      proof
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='dictionary_creation_client_journal'"
        )
        .all()
    ).toEqual([])
    proof.close()
    expect(AsyncStorage.setItem).not.toHaveBeenLastCalledWith(
      'db_schema_version',
      '23'
    )
    await initializeDatabase()
    expect(version).toBe('23')
    expect(words()).toEqual(oldWords)
    expect(events()).toEqual(oldEvents)
    expect(commands()).toEqual(oldLearning)
    expect(
      priorTables.map(name => db.prepare(`SELECT * FROM ${name}`).all())
    ).toEqual(oldRows)
    expect(
      db.prepare('SELECT * FROM dictionary_creation_client_journal').all()
    ).toEqual([])
    expect(db.prepare(CHECK_FOREIGN_KEYS).all()).toEqual([])
  })

  it('retries v21 from v20 while preserving unresolved v2/v1 roots and personal learning', async () => {
    await initializeDatabase()
    db.exec(`INSERT INTO dictionary_following_import_journal(user_id,operation_id,word_id,payload_json)
      VALUES ('qa-a','unresolved-v2','qa-a','{"kind":"import","result":null}');
      INSERT INTO dictionary_import_delivery(user_id,word_id,original_intent_json)
      VALUES ('qa-a','qa-a','{"operation_id":"unresolved-v1"}');
      DROP TABLE dictionary_following_transfer_sessions;`)
    const oldWords = words()
    const oldLearning = commands()
    const oldImports = db
      .prepare('SELECT * FROM dictionary_following_import_journal')
      .all()
    const oldDelivery = db.prepare(SELECT_DELIVERY).all()
    version = '20'
    fault = FOLLOWING_TRANSFERS_FAULT
    await closeDatabase()
    await expect(initializeDatabase()).rejects.toThrow(MIGRATION_INTERRUPTION)
    expect(version).toBe('20')
    await initializeDatabase()
    expect(version).toBe('23')
    expect(words()).toEqual(oldWords)
    expect(commands()).toEqual(oldLearning)
    expect(
      db.prepare('SELECT * FROM dictionary_following_import_journal').all()
    ).toEqual(oldImports)
    expect(db.prepare(SELECT_DELIVERY).all()).toEqual(oldDelivery)
    expect(
      db.prepare('SELECT * FROM dictionary_following_transfer_sessions').all()
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
    expect(version).toBe('23')
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
