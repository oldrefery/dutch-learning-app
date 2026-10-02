import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createMockWord } from '@/__tests__/helpers/factories'
import {
  parseDictionaryImportIntent,
  parseDictionaryImportReceipt,
  type DictionaryImportReceipt,
} from '@woordenaar/domain'
import { createTestDatabase } from './sqlite.fixture'
import { wordRepository } from '../wordRepository'
import { dictionaryImportRepository } from '../dictionaryImportRepository'
import { wordToDictionaryContent } from '../dictionaryContentMapping'
import { dictionaryContentRepository } from '../dictionaryContentRepository'
import { dictionaryPersonalRefreshRepository } from '../dictionaryPersonalRefreshRepository'

jest.mock('../initDB')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))

const CONFLICT_OUTCOME = 'identity-conflict'
const USER = '10000000-0000-4000-8000-000000000001'
const OTHER = '10000000-0000-4000-8000-000000000002'
const WORD = '20000000-0000-4000-8000-000000000001'
const PERSONAL_CONFLICT_ID = '20000000-0000-4000-8000-000000000002'
const COLLECTION = '30000000-0000-4000-8000-000000000001'
const WORD_SQL = 'SELECT * FROM words WHERE word_id = ?'
const COMMANDS_SQL =
  'SELECT * FROM dictionary_content_commands ORDER BY sequence'

describe('durable offline import identities in file-backed SQLite', () => {
  let directory: string
  let path: string
  let db: DatabaseSync
  const word = () =>
    createMockWord({
      word_id: WORD,
      user_id: USER,
      collection_id: COLLECTION,
      interval_days: 27,
      repetition_count: 7,
      next_review_date: '2026-11-01',
    })
  const create = async () => {
    const input = word()
    await wordRepository.addWords([input], undefined, [
      { kind: 'private-copy', content: wordToDictionaryContent(input) },
    ])
    return input
  }
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'woordenaar-d10-import-sqlite-'))
    path = join(directory, 'test.sqlite')
    db = createTestDatabase(path)
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it('reopens the exact immutable intent independently of later content, learning and collection changes', async () => {
    const input = await create()
    const before = await dictionaryImportRepository.getPending(USER)
    db.exec(`INSERT INTO learning_commands(operation_id,kind,user_id,word_id,reset_at)
      VALUES ('retained-reset','reset','${USER}','${WORD}','2026-10-02');`)
    await wordRepository.updateWordImage(
      WORD,
      USER,
      'https://example.invalid/private-later.jpg'
    )
    db.prepare(
      'UPDATE words SET collection_id = ?, repetition_count = 12 WHERE word_id = ?'
    ).run('new-local-target', WORD)
    const currentWord = db.prepare(WORD_SQL).get(WORD)
    const commands = db.prepare(COMMANDS_SQL).all()
    const learning = db.prepare('SELECT * FROM learning_commands').all()
    db.close()
    db = createTestDatabase(path, false)
    expect(await dictionaryImportRepository.getPending(USER)).toEqual(before)
    expect(before[0].intent.source.content).toEqual(
      wordToDictionaryContent(input)
    )
    expect(before[0].intent.collection_id).toBe(COLLECTION)
    expect(await dictionaryImportRepository.getPending(OTHER)).toEqual([])
    const receipt: DictionaryImportReceipt = {
      protocol_version: 1 as const,
      operation_id: before[0].intent.operation_id,
      word_id: WORD,
      outcome: 'inserted' as const,
      existing_word_id: null,
      idempotent: true,
    }
    await dictionaryImportRepository.acceptReceipt(
      USER,
      before[0].intent,
      receipt
    )
    expect(await dictionaryImportRepository.getPending(USER)).toEqual([])
    db.close()
    db = createTestDatabase(path, false)
    expect(
      await dictionaryImportRepository.getAcknowledgedWordIds(USER)
    ).toEqual([WORD])
    expect(
      await dictionaryImportRepository.getAcknowledgedWordIds(OTHER)
    ).toEqual([])
    expect(db.prepare(WORD_SQL).get(WORD)).toEqual(currentWord)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(commands)
    expect(db.prepare('SELECT * FROM learning_commands').all()).toEqual(
      learning
    )
  })

  it('retains the intent and all queues if recording its acknowledgement fails', async () => {
    await create()
    const [pending] = await dictionaryImportRepository.getPending(USER)
    const commands = db.prepare(COMMANDS_SQL).all()
    db.exec(`CREATE TRIGGER fail_import_ack BEFORE INSERT ON dictionary_import_acknowledgements
      BEGIN SELECT RAISE(ABORT, 'Injected acknowledgement failure'); END;`)
    await expect(
      dictionaryImportRepository.acceptReceipt(USER, pending.intent, {
        protocol_version: 1,
        operation_id: pending.intent.operation_id,
        word_id: WORD,
        outcome: 'inserted',
        existing_word_id: null,
        idempotent: true,
      })
    ).rejects.toThrow('Injected acknowledgement failure')
    expect(await dictionaryImportRepository.getPending(USER)).toEqual([pending])
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(commands)
    expect(
      await dictionaryImportRepository.getAcknowledgedWordIds(USER)
    ).toEqual([])
  })

  it('retains the card and every queue on a durable different-ID conflict and rejects another owner acknowledgement', async () => {
    await create()
    const [pending] = await dictionaryImportRepository.getPending(USER)
    const snapshot = db.prepare(WORD_SQL).get(WORD)
    const commands = db.prepare(COMMANDS_SQL).all()
    const receipt: DictionaryImportReceipt = {
      protocol_version: 1 as const,
      operation_id: pending.intent.operation_id,
      word_id: WORD,
      outcome: CONFLICT_OUTCOME,
      existing_word_id: PERSONAL_CONFLICT_ID,
      idempotent: false,
    }
    await expect(
      dictionaryImportRepository.acceptReceipt(OTHER, pending.intent, receipt)
    ).rejects.toThrow('changed before acknowledgement')
    await dictionaryImportRepository.acceptReceipt(
      USER,
      pending.intent,
      receipt
    )
    expect(
      (await dictionaryImportRepository.getPending(USER))[0]
    ).toMatchObject({
      status: 'conflict',
      existingWordId: receipt.existing_word_id,
    })
    expect(db.prepare(WORD_SQL).get(WORD)).toEqual(snapshot)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(commands)
    await wordRepository.saveWords(
      [{ ...word(), word_id: receipt.existing_word_id, repetition_count: 999 }],
      { preserveUnsynced: true }
    )
    expect(db.prepare(WORD_SQL).get(WORD)).toEqual(snapshot)
  })

  it('rotates a confirmed conflict operation while retaining the exact personal ID and queues', async () => {
    await create()
    const [pending] = await dictionaryImportRepository.getPending(USER)
    await dictionaryImportRepository.acceptReceipt(USER, pending.intent, {
      protocol_version: 1,
      operation_id: pending.intent.operation_id,
      word_id: WORD,
      outcome: CONFLICT_OUTCOME,
      existing_word_id: PERSONAL_CONFLICT_ID,
      idempotent: false,
    })
    const snapshot = db.prepare(WORD_SQL).get(WORD)
    const commands = db.prepare(COMMANDS_SQL).all()
    const nextOperationId = '40000000-0000-4000-8000-000000000009'
    await dictionaryImportRepository.retryConflict(
      USER,
      pending.intent,
      nextOperationId
    )
    expect(
      (await dictionaryImportRepository.getPending(USER))[0]
    ).toMatchObject({
      status: 'pending',
      existingWordId: null,
      intent: { ...pending.intent, operation_id: nextOperationId },
    })
    await expect(
      dictionaryImportRepository.retryConflict(
        USER,
        pending.intent,
        nextOperationId
      )
    ).rejects.toThrow('Import conflict changed')
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(commands)
    expect(db.prepare(WORD_SQL).get(WORD)).toEqual(snapshot)
  })

  it('does not deliver an import that the owner explicitly deleted offline', async () => {
    await create()
    await wordRepository.deleteWord(WORD, USER)
    expect(await dictionaryImportRepository.getPending(USER)).toEqual([])
    expect(
      db.prepare('SELECT * FROM dictionary_import_intents').all()
    ).toHaveLength(1)
    expect(db.prepare(WORD_SQL).get(WORD)?.sync_status).toBe('deleted')
  })

  it('keeps an offline import active when its target collection is unavailable during cleanup', async () => {
    await create()
    const before = db.prepare(WORD_SQL).get(WORD)
    const commands = db.prepare(COMMANDS_SQL).all()
    await wordRepository.deleteWordsByCollection(COLLECTION, USER, {
      preservePendingImports: true,
    })
    await wordRepository.deleteOrphanWords(USER)
    expect(db.prepare(WORD_SQL).get(WORD)).toEqual(before)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(commands)
    expect(await dictionaryImportRepository.getPending(USER)).toHaveLength(1)
  })

  it('rolls the whole offline creation back if intent persistence fails', async () => {
    db.exec(`CREATE TRIGGER fail_import BEFORE INSERT ON dictionary_import_intents
      BEGIN SELECT RAISE(ABORT, 'Injected intent persistence failure'); END;`)
    await expect(create()).rejects.toThrow(
      'Injected intent persistence failure'
    )
    expect(db.prepare('SELECT * FROM words').all()).toEqual([])
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
    expect(db.prepare('SELECT * FROM dictionary_card_content').all()).toEqual(
      []
    )
  })

  it('persists personal hydration debt atomically with content acknowledgement and keeps it behind newer edits', async () => {
    const input = await create()
    const [pending] = await dictionaryImportRepository.getPending(USER)
    await dictionaryImportRepository.acceptReceipt(USER, pending.intent, {
      protocol_version: 1,
      operation_id: pending.intent.operation_id,
      word_id: WORD,
      outcome: 'inserted',
      existing_word_id: null,
      idempotent: false,
    })
    const [creation] =
      await dictionaryContentRepository.getPendingCommands(USER)
    await wordRepository.updateWordImage(
      WORD,
      USER,
      'https://example.invalid/later.jpg'
    )
    const state = {
      word_id: WORD,
      user_id: USER,
      content_version: 1,
      reference: null,
      fallback_content: wordToDictionaryContent(input),
      overrides: {},
      updated_at: input.updated_at,
    }
    await dictionaryContentRepository.saveCardStates(
      [state],
      [creation.command]
    )
    db.prepare("UPDATE words SET sync_status = 'synced' WHERE word_id = ?").run(
      WORD
    )
    expect(await dictionaryPersonalRefreshRepository.getWordIds(USER)).toEqual([
      WORD,
    ])
    expect(
      await dictionaryPersonalRefreshRepository.getWordIds(USER, true)
    ).toEqual([])
    await dictionaryPersonalRefreshRepository.acknowledge(USER, [WORD])
    expect(await dictionaryPersonalRefreshRepository.getWordIds(USER)).toEqual([
      WORD,
    ])
    const [edit] = await dictionaryContentRepository.getPendingCommands(USER)
    await dictionaryContentRepository.saveCardStates(
      [
        {
          ...state,
          content_version: 2,
          fallback_content: {
            ...state.fallback_content,
            image_url: 'https://example.invalid/later.jpg',
          },
        },
      ],
      [edit.command]
    )
    db.close()
    db = createTestDatabase(path, false)
    expect(
      await dictionaryPersonalRefreshRepository.getWordIds(USER, true)
    ).toEqual([WORD])
    expect(await dictionaryPersonalRefreshRepository.getWordIds(OTHER)).toEqual(
      []
    )
    await wordRepository.saveWords([{ ...input, repetition_count: 14 }], {
      preserveUnsynced: true,
    })
    await dictionaryPersonalRefreshRepository.acknowledge(USER, [WORD])
    expect(db.prepare(WORD_SQL).get(WORD)?.repetition_count).toBe(14)
    expect(await dictionaryPersonalRefreshRepository.getWordIds(USER)).toEqual(
      []
    )
  })

  it('preserves learning queued between the hydration lookup and its UPDATE', async () => {
    const input = await create()
    db.exec(`DELETE FROM dictionary_import_intents; DELETE FROM dictionary_content_commands;
      UPDATE words SET sync_status = 'synced';
      UPDATE dictionary_import_delivery SET acknowledged_placement_revision = 0;
      INSERT INTO dictionary_personal_refresh_queue(word_id,user_id) VALUES ('${WORD}','${USER}');`)
    db.close()
    let queuedDuringHydration = false
    db = createTestDatabase(path, false, sql => {
      if (
        !queuedDuringHydration &&
        sql.includes('UPDATE words SET') &&
        sql.includes('repetition_count = ?')
      ) {
        queuedDuringHydration = true
        db.exec(`UPDATE words SET repetition_count = 21, sync_status = 'pending' WHERE word_id = '${WORD}';
          INSERT INTO learning_commands(operation_id,kind,user_id,word_id,reset_at)
          VALUES ('concurrent-reset','reset','${USER}','${WORD}','2026-10-02');`)
      }
    })
    await wordRepository.saveWords([{ ...input, repetition_count: 14 }], {
      preserveUnsynced: true,
    })
    expect(queuedDuringHydration).toBe(true)
    expect(db.prepare(WORD_SQL).get(WORD)).toMatchObject({
      repetition_count: 21,
      sync_status: 'pending',
    })
    await dictionaryPersonalRefreshRepository.acknowledge(USER, [WORD])
    expect(await dictionaryPersonalRefreshRepository.getWordIds(USER)).toEqual([
      WORD,
    ])
    expect(
      db.prepare('SELECT operation_id FROM learning_commands').all()
    ).toEqual([{ operation_id: 'concurrent-reset' }])
  })

  it('does not count retained hydration debt after explicit local deletion', async () => {
    await create()
    db.exec(
      `INSERT INTO dictionary_personal_refresh_queue(word_id,user_id) VALUES ('${WORD}','${USER}');`
    )
    await wordRepository.deleteWord(WORD, USER)
    expect(await dictionaryPersonalRefreshRepository.getWordIds(USER)).toEqual(
      []
    )
    expect(
      db.prepare('SELECT * FROM dictionary_personal_refresh_queue').all()
    ).toHaveLength(1)
  })

  it('rejects mismatched immutable content, SRS fields, and malformed receipts without clearing intent', async () => {
    const input = word()
    await expect(
      wordRepository.addWords([input], undefined, [
        {
          kind: 'private-copy',
          content: { ...wordToDictionaryContent(input), plural: 'forged' },
        },
      ])
    ).rejects.toThrow('does not match')
    expect(db.prepare('SELECT * FROM words').all()).toEqual([])
    await create()
    const [pending] = await dictionaryImportRepository.getPending(USER)
    expect(() =>
      parseDictionaryImportIntent({ ...pending.intent, repetition_count: 8 })
    ).toThrow('Invalid dictionary import intent')
    expect(() =>
      parseDictionaryImportReceipt(
        {
          protocol_version: 1,
          operation_id: pending.intent.operation_id,
          word_id: WORD,
          outcome: CONFLICT_OUTCOME,
          existing_word_id: WORD,
          idempotent: false,
        },
        pending.intent
      )
    ).toThrow('Invalid dictionary import receipt')
    expect(await dictionaryImportRepository.getPending(USER)).toHaveLength(1)
  })
})
