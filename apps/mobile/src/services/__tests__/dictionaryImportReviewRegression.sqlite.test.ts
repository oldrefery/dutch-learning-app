import { supabase } from '@/lib/supabase'
import { dictionaryImportRepository as imports } from '@/db/dictionaryImportRepository'
import { dictionaryImportCancellationRepository as cancellation } from '@/db/dictionaryImportCancellationRepository'
import { dictionaryImportRecoveryRepository as recovery } from '@/db/dictionaryImportRecoveryRepository'
import { dictionaryImportRecoveryViewRepository as view } from '@/db/dictionaryImportRecoveryViewRepository'
import { wordRepository } from '@/db/wordRepository'
import { getLastSyncTimestamp, isNetworkAvailable } from '@/utils/network'
import { SyncManager } from '../syncManager'
import { dictionaryImportSync } from '../dictionaryImportSync'
import { syncStatusService } from '../syncStatusService'
import {
  openImportFixture,
  USER,
  WORD,
  TARGET,
  NEXT,
  ORIGINAL,
  CANCEL,
  REPLACEMENT,
  assertOwner,
  DELIVERY_SQL,
  WORD_SQL,
  OUTBOX_SQL,
} from './dictionaryImportSync.fixture'
import {
  parseDictionaryImportRecovery,
  type DictionaryImportRecovery,
} from '@woordenaar/domain'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')
jest.mock('@/lib/sentry')
jest.mock('@/utils/network')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
const LOST_REPLY = 'Lost reply'
const SAVED_IMPORTS = 'Saved imports'
const STATE_CONFLICT = 'state-conflict'
const RECOVERY_RPC = 'recover_dictionary_import_v1'
const rpc = supabase.rpc as unknown as jest.Mock<
  Promise<ReturnType<typeof response>>,
  [string, unknown]
>
const response = (data: unknown) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
})
let fixture: ReturnType<typeof openImportFixture>
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(supabase.rpc).mockReset()
  fixture = openImportFixture()
  Object.assign(supabase.auth, { getUser: jest.fn() })
  jest.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: USER } },
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getUser>>)
  jest.mocked(isNetworkAvailable).mockResolvedValue(true)
  jest.mocked(getLastSyncTimestamp).mockResolvedValue('2026-10-02T10:00:00Z')
})
afterEach(() => fixture.close())
async function acknowledgedImport() {
  const request = await fixture.create()
  await imports.acceptReceipt(
    USER,
    request.original_intent,
    {
      protocol_version: 1,
      operation_id: request.original_intent.operation_id,
      word_id: WORD,
      outcome: 'inserted',
      existing_word_id: null,
      idempotent: false,
    },
    assertOwner
  )
  return request
}
async function queuedMove() {
  await acknowledgedImport()
  await wordRepository.moveWordToCollection(WORD, USER, TARGET)
  return parseDictionaryImportRecovery(
    (await recovery.getPending(USER))[0].request
  )
}
function receipt(request: DictionaryImportRecovery) {
  return response({
    protocol_version: 1,
    operation_id: request.operation_id,
    original_operation_id: request.original_intent.operation_id,
    word_id: WORD,
    target_collection_id: request.target_collection_id,
    outcome: 'applied',
    existing_word_id: null,
    recovery_version: 1,
    idempotent: true,
  })
}
function metadataAttempt() {
  const query = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({
      data: [
        {
          word_id: WORD,
          collection_id: NEXT,
          updated_at: '2026-10-02T10:01:00Z',
          deleted_at: null,
        },
      ],
      error: null,
    }),
  }
  const update = jest.fn()
  jest.mocked(supabase.from).mockReturnValue({
    select: jest.fn(() => query),
    update,
  } as unknown as ReturnType<typeof supabase.from>)
  const manager = new SyncManager() as unknown as {
    executeDictionaryWordMetadataUpsert(
      payloads: { word_id: string; user_id: string; collection_id: string }[]
    ): Promise<unknown>
  }
  return {
    update,
    run: () =>
      manager.executeDictionaryWordMetadataUpsert([
        { word_id: WORD, user_id: USER, collection_id: TARGET },
      ]),
  }
}
it('keeps normal word deletion pending through cancellation ACK, failed delivery and restart', async () => {
  await acknowledgedImport()
  const request = await cancellation.prepare(USER, WORD, CANCEL, assertOwner)
  expect((await syncStatusService.getSnapshot(USER)).pendingWords).toBe(1)
  await cancellation.accept(
    USER,
    request,
    {
      protocol_version: 1,
      operation_id: CANCEL,
      original_operation_id: request.original_intent.operation_id,
      word_id: WORD,
      outcome: 'cancelled',
      recovery_version: 1,
      idempotent: false,
    },
    assertOwner
  )
  const query = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    select: jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Offline' } }),
  }
  jest
    .mocked(supabase.from)
    .mockReturnValue({ update: jest.fn(() => query) } as unknown as ReturnType<
      typeof supabase.from
    >)
  const manager = new SyncManager() as unknown as {
    dictionaryContentAvailable: boolean
    pushWordTombstones(
      owner: string,
      rows: Awaited<ReturnType<typeof wordRepository.getDeletedWords>>
    ): Promise<number>
  }
  manager.dictionaryContentAvailable = true
  await expect(
    manager.pushWordTombstones(USER, await wordRepository.getDeletedWords(USER))
  ).rejects.toThrow('Offline')
  fixture.reopen()
  expect(await wordRepository.getDeletedWords(USER)).toHaveLength(1)
  expect((await syncStatusService.getSnapshot(USER)).totalPending).toBe(1)
  expect((await syncStatusService.getSnapshot(CANCEL)).totalPending).toBe(0)
  query.select.mockResolvedValue({
    data: [
      {
        word_id: WORD,
        updated_at: '2026-10-02T11:00:00Z',
        deleted_at: '2026-10-02T11:00:00Z',
      },
    ],
    error: null,
  })
  await expect(
    manager.pushWordTombstones(USER, await wordRepository.getDeletedWords(USER))
  ).resolves.toBe(1)
  expect(await wordRepository.getDeletedWords(USER)).toEqual([])
  expect((await syncStatusService.getSnapshot(USER)).totalPending).toBe(0)
})
it('counts collection tombstones until acknowledged, independently of active metadata', async () => {
  fixture.db
    .prepare(
      "UPDATE collections SET sync_status = 'deleted' WHERE collection_id = ?"
    )
    .run(TARGET)
  fixture.reopen()
  expect((await syncStatusService.getSnapshot(USER)).pendingCollections).toBe(1)
  fixture.db
    .prepare(
      "UPDATE collections SET sync_status = 'synced' WHERE collection_id = ?"
    )
    .run(TARGET)
  expect((await syncStatusService.getSnapshot(USER)).totalPending).toBe(0)
})
it('queues an immutable guarded ordinary move and refuses generic metadata delivery', async () => {
  const request = await queuedMove()
  expect(request).toMatchObject({
    expected_recovery_version: 0,
    expected_collection_id: ORIGINAL,
    target_collection_id: TARGET,
    original_intent: { word_id: WORD, collection_id: ORIGINAL },
  })
  fixture.reopen()
  expect((await recovery.getPending(USER))[0].request).toEqual(request)
  const attempt = metadataAttempt()
  await expect(attempt.run()).rejects.toThrow(SAVED_IMPORTS)
  expect(attempt.update).not.toHaveBeenCalled()
  expect(fixture.db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    local_placement_revision: 1,
    acknowledged_placement_revision: 0,
  })
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    collection_id: TARGET,
    repetition_count: 7,
    interval_days: 27,
  })
})
it('replays an ordinary move with identical input after lost reply and restart', async () => {
  const request = await queuedMove()
  jest
    .mocked(supabase.rpc)
    .mockRejectedValueOnce(new Error(LOST_REPLY))
    .mockResolvedValueOnce(receipt(request))
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(LOST_REPLY)
  fixture.reopen()
  await expect(dictionaryImportSync.push(USER)).resolves.toBe(1)
  expect(supabase.rpc).toHaveBeenNthCalledWith(1, RECOVERY_RPC, {
    p_request: request,
  })
  expect(supabase.rpc).toHaveBeenNthCalledWith(2, RECOVERY_RPC, {
    p_request: request,
  })
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
  expect(fixture.db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    recovery_version: 1,
    local_placement_revision: 1,
    acknowledged_placement_revision: 1,
  })
})
it('retains a stale ordinary move as an explicit conflict after another client recovers', async () => {
  const request = await queuedMove()
  jest.mocked(supabase.rpc).mockResolvedValue(
    response({
      protocol_version: 1,
      operation_id: request.operation_id,
      original_operation_id: request.original_intent.operation_id,
      word_id: WORD,
      target_collection_id: TARGET,
      outcome: STATE_CONFLICT,
      state: {
        protocol_version: 1,
        original_operation_id: request.original_intent.operation_id,
        word_id: WORD,
        recovery_version: 1,
        inserted_once: true,
        state: 'active',
        collection_id: NEXT,
      },
    })
  )
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(STATE_CONFLICT)
  expect(await view.getIssues(USER)).toEqual([
    { word_id: WORD, issue: STATE_CONFLICT },
  ])
  fixture.reopen()
  jest.mocked(supabase.rpc).mockClear()
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(STATE_CONFLICT)
  expect(supabase.rpc).not.toHaveBeenCalled()
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    payload_json: JSON.stringify(request),
  })
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.acknowledged_placement_revision
  ).toBe(0)
})
it('never infers a base or clears retained unbound placement debt', async () => {
  await acknowledgedImport()
  fixture.db.exec(
    'UPDATE dictionary_import_delivery SET local_placement_revision = 1'
  )
  fixture.db
    .prepare("UPDATE words SET collection_id = ?,sync_status = 'pending'")
    .run(TARGET)
  fixture.reopen()
  const attempt = metadataAttempt()
  await expect(attempt.run()).rejects.toThrow(SAVED_IMPORTS)
  await expect(
    wordRepository.moveWordToCollection(WORD, USER, NEXT)
  ).rejects.toThrow(SAVED_IMPORTS)
  expect(attempt.update).not.toHaveBeenCalled()
  expect(await view.getIssues(USER)).toEqual([
    { word_id: WORD, issue: 'pending' },
  ])
  expect(fixture.db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    local_placement_revision: 1,
    acknowledged_placement_revision: 0,
  })
})
it('rejects stale ordinary-move receipt after explicit proposal replacement without losing the new target', async () => {
  const request = await queuedMove()
  const replacement = {
    ...request,
    operation_id: REPLACEMENT,
    target_collection_id: NEXT,
  }
  rpc.mockImplementationOnce(async () => {
    await recovery.prepare(USER, replacement, request.operation_id, assertOwner)
    return receipt(request)
  })
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow('changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    payload_json: JSON.stringify(replacement),
    status: 'pending',
    placement_revision: 2,
  })
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.collection_id).toBe(NEXT)
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.acknowledged_placement_revision
  ).toBe(0)
})
it('rolls back ordinary move and proposal together on a local owner change', async () => {
  await acknowledgedImport()
  let checks = 0
  await expect(
    wordRepository.moveWordToCollection(WORD, USER, TARGET, () => {
      if (++checks === 2) throw new Error('Owner changed')
    })
  ).rejects.toThrow('Owner changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.collection_id).toBe(ORIGINAL)
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.local_placement_revision
  ).toBe(0)
})

it('preserves private edits and learning queues made during ordinary move delivery', async () => {
  const request = await queuedMove()
  let commands: unknown[] = []
  rpc.mockImplementationOnce(async () => {
    await wordRepository.updateWordImage(
      WORD,
      USER,
      'https://example.invalid/later.jpg'
    )
    fixture.db
      .exec(`INSERT INTO learning_commands(operation_id,kind,user_id,word_id,reset_at)
      VALUES ('retained-reset','reset','${USER}','${WORD}','2026-10-02');`)
    fixture.db
      .prepare('UPDATE words SET repetition_count = 12 WHERE word_id = ?')
      .run(WORD)
    commands = fixture.db
      .prepare('SELECT * FROM dictionary_content_commands')
      .all()
    return receipt(request)
  })
  await expect(dictionaryImportSync.push(USER)).resolves.toBe(1)
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    image_url: 'https://example.invalid/later.jpg',
    repetition_count: 12,
    interval_days: 27,
  })
  expect(
    fixture.db.prepare('SELECT * FROM dictionary_content_commands').all()
  ).toEqual(commands)
  expect(
    fixture.db.prepare('SELECT * FROM learning_commands').all()
  ).toHaveLength(1)
})

it('does not acknowledge ordinary move delivery after account sign-out and same-owner return', async () => {
  const request = await queuedMove()
  jest
    .mocked(supabase.auth.onAuthStateChange)
    .mockImplementationOnce(listener => {
      rpc.mockImplementationOnce(async () => {
        listener('SIGNED_OUT', null)
        listener('SIGNED_IN', { user: { id: USER } } as NonNullable<
          Parameters<typeof listener>[1]
        >)
        return receipt(request)
      })
      return {
        data: {
          subscription: {
            id: 'ordinary-move-owner-watch',
            callback: listener,
            unsubscribe: jest.fn(),
          },
        },
      }
    })
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(
    'Authentication changed'
  )
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    payload_json: JSON.stringify(request),
    status: 'pending',
  })
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.acknowledged_placement_revision
  ).toBe(0)
})
