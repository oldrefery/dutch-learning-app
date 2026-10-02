import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createMockWord } from '@/__tests__/helpers/factories'
import {
  type DictionaryImportRecovery,
  type DictionaryImportRecoveryReceipt,
} from '@woordenaar/domain'
import { createTestDatabase } from './sqlite.fixture'
import { wordRepository } from '../wordRepository'
import { dictionaryImportRepository } from '../dictionaryImportRepository'
import { dictionaryImportRecoveryRepository as recovery } from '../dictionaryImportRecoveryRepository'
import { dictionaryImportCancellationRepository as cancellation } from '../dictionaryImportCancellationRepository'
import { acceptDictionaryImportRecovery as accept } from '../dictionaryImportRecoveryAcknowledgement'
import { MIGRATION_V16_DICTIONARY_IMPORT_RECOVERY } from '../dictionaryImportRecoverySchema'
import { wordToDictionaryContent } from '../dictionaryContentMapping'

jest.mock('../initDB')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
const USER = '10000000-0000-4000-8000-000000000001'
const OTHER = '10000000-0000-4000-8000-000000000002'
const WORD = '20000000-0000-4000-8000-000000000001'
const SECOND_WORD = '20000000-0000-4000-8000-000000000002'
const OWNER_CHANGED = 'Owner changed'
const ORIGINAL = '30000000-0000-4000-8000-000000000001'
const TARGET = '30000000-0000-4000-8000-000000000002'
const NEXT = '30000000-0000-4000-8000-000000000003'
const OPERATION = '40000000-0000-4000-8000-000000000001'
const REPLACEMENT = '40000000-0000-4000-8000-000000000002'
const CANCEL = '40000000-0000-4000-8000-000000000003'
const WORD_SQL = 'SELECT * FROM words WHERE word_id = ?'
const DELIVERY_SQL =
  'SELECT * FROM dictionary_import_delivery WHERE word_id = ?'
const IDENTITY_CONFLICT = 'identity-conflict'
const assertOwner = () => {}

let directory: string
let path: string
let db: DatabaseSync
const queues = () => ({
  content: db
    .prepare('SELECT * FROM dictionary_content_commands ORDER BY sequence')
    .all(),
  learning: db
    .prepare('SELECT * FROM learning_commands ORDER BY sequence')
    .all(),
})
const receipt = (
  request: DictionaryImportRecovery
): DictionaryImportRecoveryReceipt => ({
  protocol_version: 1,
  operation_id: request.operation_id,
  original_operation_id: request.original_intent.operation_id,
  word_id: request.original_intent.word_id,
  target_collection_id: request.target_collection_id,
  outcome: 'applied',
  existing_word_id: null,
  recovery_version: request.expected_recovery_version + 1,
  idempotent: false,
})
async function create(wordId = WORD) {
  const word = createMockWord({
    word_id: wordId,
    dutch_lemma: `fixture-${wordId}`,
    user_id: USER,
    collection_id: ORIGINAL,
    repetition_count: 7,
    interval_days: 27,
    next_review_date: '2026-11-01',
  })
  await wordRepository.addWords([word], undefined, [
    { kind: 'private-copy', content: wordToDictionaryContent(word) },
  ])
  const pending = (await dictionaryImportRepository.getPending(USER)).find(
    row => row.intent.word_id === wordId
  )!
  return {
    protocol_version: 1 as const,
    operation_id: OPERATION,
    original_intent: pending.intent,
    expected_recovery_version: 0,
    expected_collection_id: ORIGINAL,
    target_collection_id: TARGET,
  }
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'woordenaar-d10-recovery-sqlite-'))
  path = join(directory, 'test.sqlite')
  db = createTestDatabase(path)
  for (const id of [ORIGINAL, TARGET, NEXT]) {
    db.prepare(
      `INSERT INTO collections(collection_id,user_id,name,created_at,updated_at)
      VALUES (?,?,?,'2026-10-02','2026-10-02')`
    ).run(id, USER, id)
  }
})
afterEach(() => {
  db.close()
  rmSync(directory, { recursive: true, force: true })
})

it('persists exact origin/outbox across restart while retaining personal SRS and every queue', async () => {
  const request = await create()
  db.exec(`INSERT INTO learning_commands(operation_id,kind,user_id,word_id,reset_at)
    VALUES ('retained-reset','reset','${USER}','${WORD}','2026-10-02');`)
  const before = queues()
  await recovery.prepare(USER, request, null, assertOwner)
  db.close()
  db = createTestDatabase(path, false)
  expect((await recovery.getPending(USER))[0].request).toEqual(request)
  expect((await dictionaryImportRepository.getPending(USER))[0].intent).toEqual(
    request.original_intent
  )
  expect(db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    collection_id: TARGET,
    repetition_count: 7,
    interval_days: 27,
  })
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    local_placement_revision: 1,
    acknowledged_placement_revision: null,
  })
  expect(queues()).toEqual(before)
})

it('replacing a proposal rejects stale acknowledgements/errors and preserves later learning/private edits', async () => {
  const a = await create()
  await recovery.prepare(USER, a, null, assertOwner)
  const b = { ...a, operation_id: REPLACEMENT, target_collection_id: NEXT }
  await recovery.prepare(USER, b, a.operation_id, assertOwner)
  await wordRepository.updateWordImage(
    WORD,
    USER,
    'https://example.invalid/later.jpg'
  )
  db.prepare('UPDATE words SET repetition_count = 12 WHERE word_id = ?').run(
    WORD
  )
  const before = queues()
  const word = db.prepare(WORD_SQL).get(WORD)
  await expect(accept(USER, a, receipt(a), assertOwner)).rejects.toThrow(
    'changed'
  )
  await expect(
    recovery.markError(USER, a, 'Old error', assertOwner)
  ).rejects.toThrow('changed')
  await expect(
    dictionaryImportRepository.acceptReceipt(USER, a.original_intent, {
      protocol_version: 1,
      operation_id: a.original_intent.operation_id,
      word_id: WORD,
      outcome: 'inserted',
      existing_word_id: null,
      idempotent: true,
    })
  ).rejects.toThrow('changed')
  await accept(USER, b, receipt(b), assertOwner)
  expect(await recovery.getPending(USER)).toEqual([])
  expect(await dictionaryImportRepository.getPending(USER)).toEqual([])
  expect(db.prepare(WORD_SQL).get(WORD)).toEqual(word)
  expect(queues()).toEqual(before)
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    local_placement_revision: 2,
    acknowledged_placement_revision: 2,
  })
  expect(await dictionaryImportRepository.getAcknowledgedWordIds(USER)).toEqual(
    [WORD]
  )
})

it('typed semantic and version conflicts retain identities/queues and never rotate the claimed original root', async () => {
  const request = await create()
  await recovery.prepare(USER, request, null, assertOwner)
  const before = queues()
  await accept(
    USER,
    request,
    {
      ...receipt(request),
      outcome: IDENTITY_CONFLICT,
      existing_word_id: SECOND_WORD,
    },
    assertOwner
  )
  expect((await recovery.getPending(USER))[0].status).toBe(IDENTITY_CONFLICT)
  db.prepare(
    "UPDATE dictionary_import_intents SET status = 'conflict' WHERE word_id = ?"
  ).run(WORD)
  await expect(
    dictionaryImportRepository.retryConflict(
      USER,
      request.original_intent,
      REPLACEMENT
    )
  ).rejects.toThrow('changed')
  const next = {
    ...request,
    operation_id: REPLACEMENT,
    expected_recovery_version: 1,
  }
  await recovery.prepare(USER, next, request.operation_id, assertOwner)
  await accept(
    USER,
    next,
    {
      protocol_version: 1,
      operation_id: next.operation_id,
      original_operation_id: request.original_intent.operation_id,
      word_id: WORD,
      target_collection_id: TARGET,
      outcome: 'state-conflict',
      state: {
        protocol_version: 1,
        original_operation_id: request.original_intent.operation_id,
        word_id: WORD,
        recovery_version: 2,
        inserted_once: true,
        state: 'active',
        collection_id: NEXT,
      },
    },
    assertOwner
  )
  expect((await recovery.getPending(USER))[0].request).toEqual(next)
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    recovery_version: 2,
    acknowledged_placement_revision: null,
  })
  expect(queues()).toEqual(before)
})

it('cancellation supersedes recovery durably and keeps the tombstone/queues after barrier acknowledgement', async () => {
  const request = await create()
  await recovery.prepare(USER, request, null, assertOwner)
  const before = queues()
  const cancel = await cancellation.prepare(USER, WORD, CANCEL, assertOwner)
  expect(
    await cancellation.prepare(USER, WORD, REPLACEMENT, assertOwner)
  ).toEqual(cancel)
  await expect(
    accept(USER, request, receipt(request), assertOwner)
  ).rejects.toThrow('changed')
  db.close()
  db = createTestDatabase(path, false)
  expect((await recovery.getPending(USER))[0]).toMatchObject({
    kind: 'cancel',
    request: cancel,
  })
  await cancellation.accept(
    USER,
    cancel,
    {
      protocol_version: 1,
      operation_id: cancel.operation_id,
      original_operation_id: cancel.original_intent.operation_id,
      word_id: WORD,
      outcome: 'cancelled',
      recovery_version: 1,
      idempotent: true,
    },
    assertOwner
  )
  expect(await recovery.getPending(USER)).toEqual([])
  expect(db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    sync_status: 'deleted',
  })
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({ cancelled: 1 })
  expect(queues()).toEqual(before)
  await expect(
    recovery.prepare(USER, request, null, assertOwner)
  ).rejects.toThrow('changed')
})

it('owner switch, foreign target and persistence faults roll back placement and outbox atomically', async () => {
  const request = await create()
  const word = db.prepare(WORD_SQL).get(WORD)
  const actor = jest
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error(OWNER_CHANGED)
    })
  await expect(recovery.prepare(USER, request, null, actor)).rejects.toThrow(
    OWNER_CHANGED
  )
  expect(db.prepare(WORD_SQL).get(WORD)).toEqual(word)
  expect(await recovery.getPending(USER)).toEqual([])
  await expect(
    recovery.prepare(OTHER, request, null, assertOwner)
  ).rejects.toThrow('changed')
  db.prepare('UPDATE collections SET user_id = ? WHERE collection_id = ?').run(
    OTHER,
    TARGET
  )
  await expect(
    recovery.prepare(USER, request, null, assertOwner)
  ).rejects.toThrow('changed')
  db.prepare('UPDATE collections SET user_id = ? WHERE collection_id = ?').run(
    USER,
    TARGET
  )
  db.exec(`CREATE TRIGGER fail_outbox BEFORE INSERT ON dictionary_import_recovery_outbox
    BEGIN SELECT RAISE(ABORT,'Injected outbox failure'); END;`)
  await expect(
    recovery.prepare(USER, request, null, assertOwner)
  ).rejects.toThrow('Injected outbox failure')
  expect(db.prepare(WORD_SQL).get(WORD)).toEqual(word)
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    local_placement_revision: 0,
  })
})

it('batch cancellation rolls back every tombstone if one request cannot be persisted', async () => {
  await create()
  const second = SECOND_WORD
  await create(second)
  db.exec(`CREATE TRIGGER fail_second_cancel BEFORE INSERT ON dictionary_import_recovery_outbox
    WHEN NEW.word_id = '${second}' BEGIN SELECT RAISE(ABORT,'Injected batch failure'); END;`)
  await expect(
    cancellation.prepareMany(
      USER,
      [
        { wordId: WORD, operationId: CANCEL },
        { wordId: second, operationId: REPLACEMENT },
      ],
      assertOwner
    )
  ).rejects.toThrow('Injected batch failure')
  expect(db.prepare(WORD_SQL).get(WORD)).toMatchObject({ deleted_at: null })
  expect(db.prepare(WORD_SQL).get(second)).toMatchObject({ deleted_at: null })
  expect(await recovery.getPending(USER)).toEqual([])
})

it('receipt persistence failure preserves exact recovery and all queues', async () => {
  const request = await create()
  await recovery.prepare(USER, request, null, assertOwner)
  const before = queues()
  db.exec(`CREATE TRIGGER fail_retirement BEFORE DELETE ON dictionary_import_recovery_outbox
    BEGIN SELECT RAISE(ABORT,'Injected receipt failure'); END;`)
  await expect(
    accept(USER, request, receipt(request), assertOwner)
  ).rejects.toThrow('Injected receipt failure')
  expect((await recovery.getPending(USER))[0].request).toEqual(request)
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    acknowledged_placement_revision: null,
  })
  expect(await dictionaryImportRepository.getAcknowledgedWordIds(USER)).toEqual(
    []
  )
  expect(queues()).toEqual(before)
})

it('upgrade preserves exact v14 intents and leaves v15-only provenance/placement unknown', async () => {
  const request = await create()
  const acknowledged = SECOND_WORD
  await wordRepository.addWord(
    createMockWord({
      word_id: acknowledged,
      dutch_lemma: 'acknowledged-fixture',
      user_id: USER,
      collection_id: ORIGINAL,
    })
  )
  db.prepare(
    'INSERT INTO dictionary_import_acknowledgements(word_id,user_id) VALUES (?,?)'
  ).run(acknowledged, USER)
  const before = queues()
  db.exec(
    'DROP TABLE dictionary_import_recovery_outbox; DROP TABLE dictionary_import_delivery;'
  )
  db.exec(MIGRATION_V16_DICTIONARY_IMPORT_RECOVERY)
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    original_intent_json: JSON.stringify(request.original_intent),
    acknowledged_placement_revision: null,
  })
  expect(db.prepare(DELIVERY_SQL).get(acknowledged)).toMatchObject({
    original_intent_json: null,
    recovery_version: null,
    acknowledged_placement_revision: null,
  })
  await expect(
    cancellation.prepare(USER, acknowledged, CANCEL, assertOwner)
  ).rejects.toThrow('provenance is unavailable')
  expect(() =>
    db
      .prepare(
        'UPDATE dictionary_import_delivery SET original_intent_json = ? WHERE word_id = ?'
      )
      .run(
        JSON.stringify({ ...request.original_intent, word_id: acknowledged }),
        acknowledged
      )
  ).toThrow('immutable')
  expect(queues()).toEqual(before)
})

it('requires exact proposal replacement and protects persisted nonce input from mutation', async () => {
  const request = await create()
  await recovery.prepare(USER, request, null, assertOwner)
  await expect(
    recovery.prepare(
      USER,
      { ...request, operation_id: REPLACEMENT },
      null,
      assertOwner
    )
  ).rejects.toThrow('changed')
  expect(() =>
    db
      .prepare(
        "UPDATE dictionary_import_recovery_outbox SET payload_json = '{}' WHERE word_id = ?"
      )
      .run(WORD)
  ).toThrow('immutable')
  db.prepare('UPDATE words SET collection_id = ? WHERE word_id = ?').run(
    NEXT,
    WORD
  )
  await expect(
    accept(USER, request, receipt(request), assertOwner)
  ).rejects.toThrow('changed')
})

it('detected owner change during acknowledgement rolls back provenance and retirement', async () => {
  const request = await create()
  await recovery.prepare(USER, request, null, assertOwner)
  const actor = jest
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error(OWNER_CHANGED)
    })
  await expect(accept(USER, request, receipt(request), actor)).rejects.toThrow(
    OWNER_CHANGED
  )
  expect((await recovery.getPending(USER))[0].request).toEqual(request)
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    acknowledged_placement_revision: null,
    recovery_version: 0,
  })
  expect(await dictionaryImportRepository.getAcknowledgedWordIds(USER)).toEqual(
    []
  )
})

it('cancellation acknowledgement failure retains the barrier and tombstone', async () => {
  await create()
  const request = await cancellation.prepare(USER, WORD, CANCEL, assertOwner)
  const before = queues()
  db.exec(`CREATE TRIGGER fail_cancel_ack BEFORE DELETE ON dictionary_import_recovery_outbox
    BEGIN SELECT RAISE(ABORT,'Injected cancellation receipt failure'); END;`)
  await expect(
    cancellation.accept(
      USER,
      request,
      {
        protocol_version: 1,
        operation_id: request.operation_id,
        original_operation_id: request.original_intent.operation_id,
        word_id: WORD,
        outcome: 'cancelled',
        recovery_version: 1,
        idempotent: false,
      },
      assertOwner
    )
  ).rejects.toThrow('Injected cancellation receipt failure')
  expect((await recovery.getPending(USER))[0].request).toEqual(request)
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({ cancelled: 0 })
  expect(db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    sync_status: 'deleted',
  })
  expect(queues()).toEqual(before)
})

it('retains immutable origin and monotonic delivery watermarks after acknowledgement', async () => {
  const request = await create()
  await recovery.prepare(USER, request, null, assertOwner)
  await accept(USER, request, receipt(request), assertOwner)
  const before = db.prepare(DELIVERY_SQL).get(WORD)
  expect(() =>
    db
      .prepare(
        'UPDATE dictionary_import_delivery SET original_intent_json = ? WHERE word_id = ?'
      )
      .run(
        JSON.stringify({
          ...request.original_intent,
          operation_id: REPLACEMENT,
        }),
        WORD
      )
  ).toThrow('immutable')
  for (const column of [
    'local_placement_revision',
    'acknowledged_placement_revision',
    'recovery_version',
  ]) {
    expect(() =>
      db
        .prepare(
          `UPDATE dictionary_import_delivery SET ${column} = 0 WHERE word_id = ?`
        )
        .run(WORD)
    ).toThrow('cannot regress')
  }
  expect(db.prepare(DELIVERY_SQL).get(WORD)).toEqual(before)
})
