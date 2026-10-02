import { dictionaryImportRepository } from '../dictionaryImportRepository'
import { dictionaryImportDeletionRepository as deletion } from '../dictionaryImportDeletionRepository'
import { dictionaryImportRecoveryRepository as recovery } from '../dictionaryImportRecoveryRepository'
import { wordRepository } from '../wordRepository'
import {
  openImportFixture,
  USER,
  WORD,
  SECOND,
  ORIGINAL,
  TARGET,
  assertOwner,
  WORD_SQL,
  OUTBOX_SQL,
} from '@/services/__tests__/dictionaryImportSync.fixture'

jest.mock('../initDB')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
let fixture: ReturnType<typeof openImportFixture>
beforeEach(() => {
  fixture = openImportFixture()
})
afterEach(() => fixture.close())

it('explicit word deletion atomically creates cancellation and preserves every command', async () => {
  await fixture.create()
  const commands = fixture.db
    .prepare('SELECT * FROM dictionary_content_commands')
    .all()
  await wordRepository.deleteWord(WORD, USER)
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    kind: 'cancel',
    status: 'pending',
  })
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.deleted_at).toBeTruthy()
  expect(
    fixture.db.prepare('SELECT * FROM dictionary_content_commands').all()
  ).toEqual(commands)
  await expect(deletion.assertSettled(USER)).rejects.toThrow(
    'cancellation is pending'
  )
})

it('bulk explicit deletion saves barriers, all tombstones and the collection in one transaction', async () => {
  await fixture.create()
  await fixture.create(SECOND)
  await deletion.deleteCollection(USER, ORIGINAL, assertOwner)
  for (const id of [WORD, SECOND]) {
    expect(fixture.db.prepare(OUTBOX_SQL).get(id)?.kind).toBe('cancel')
    expect(fixture.db.prepare(WORD_SQL).get(id)?.deleted_at).toBeTruthy()
  }
  expect(
    fixture.db
      .prepare('SELECT sync_status FROM collections WHERE collection_id = ?')
      .get(ORIGINAL)?.sync_status
  ).toBe('deleted')
})

it('rolls back the entire collection deletion on barrier failure', async () => {
  await fixture.create()
  await fixture.create(SECOND)
  fixture.db
    .exec(`CREATE TRIGGER fail_barrier BEFORE INSERT ON dictionary_import_recovery_outbox
    WHEN NEW.word_id='${SECOND}' BEGIN SELECT RAISE(ABORT,'Injected barrier failure'); END`)
  await expect(
    deletion.deleteCollection(USER, ORIGINAL, assertOwner)
  ).rejects.toThrow('Injected barrier failure')
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.deleted_at).toBeNull()
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
  expect(
    fixture.db
      .prepare('SELECT sync_status FROM collections WHERE collection_id = ?')
      .get(ORIGINAL)?.sync_status
  ).not.toBe('deleted')
})

it('retains imports on remote target cleanup and never fabricates their cancellation', async () => {
  const request = await fixture.create()
  await recovery.prepare(USER, request, null, assertOwner)
  await wordRepository.deleteWordsByCollection(TARGET, USER, {
    preservePendingImports: true,
  })
  fixture.db
    .prepare('DELETE FROM collections WHERE collection_id=?')
    .run(TARGET)
  await wordRepository.deleteOrphanWords(USER)
  await deletion.queueRetainedTombstones(USER, assertOwner)
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.deleted_at).toBeNull()
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)?.kind).toBe('recovery')
})

it('upgrades already retained import tombstones to cancellation before any ordinary deletion', async () => {
  await fixture.create()
  fixture.db
    .prepare(
      "UPDATE words SET deleted_at='2026-10-02',sync_status='deleted' WHERE word_id=?"
    )
    .run(WORD)
  await expect(deletion.assertSettled(USER)).rejects.toThrow(
    'cancellation is pending'
  )
  await deletion.queueRetainedTombstones(USER, assertOwner)
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)?.kind).toBe('cancel')
})

it('standalone explicit bulk word deletion persists every cancellation', async () => {
  await fixture.create()
  await fixture.create(SECOND)
  await wordRepository.deleteWordsByCollection(ORIGINAL, USER)
  for (const id of [WORD, SECOND])
    expect(fixture.db.prepare(OUTBOX_SQL).get(id)?.kind).toBe('cancel')
})

it('remote tombstones of acknowledged cards do not fabricate a local cancellation', async () => {
  const request = await fixture.create()
  await dictionaryImportRepository.acceptReceipt(
    USER,
    request.original_intent,
    {
      protocol_version: 1,
      operation_id: request.original_intent.operation_id,
      word_id: WORD,
      outcome: 'inserted',
      existing_word_id: null,
      idempotent: true,
    },
    assertOwner
  )
  const [word] = await wordRepository.getWordsByUserId(USER)
  await wordRepository.saveRemoteWordTombstones([
    { ...word, deleted_at: '2026-10-02' },
  ])
  await deletion.queueRetainedTombstones(USER, assertOwner)
  await expect(deletion.assertSettled(USER)).resolves.toBeUndefined()
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    deleted_at: '2026-10-02',
    sync_status: 'synced',
  })
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
})
