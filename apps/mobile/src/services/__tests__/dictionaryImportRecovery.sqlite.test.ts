import { supabase } from '@/lib/supabase'
import { dictionaryImportRecovery } from '../dictionaryImportRecovery'
import { dictionaryImportRecoveryRepository as recovery } from '@/db/dictionaryImportRecoveryRepository'
import { dictionaryImportRecoveryViewRepository as view } from '@/db/dictionaryImportRecoveryViewRepository'
import { dictionaryImportCancellationRepository as cancellation } from '@/db/dictionaryImportCancellationRepository'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryImportRepository } from '@/db/dictionaryImportRepository'
import {
  openImportFixture,
  USER,
  WORD,
  TARGET,
  NEXT,
  CANCEL,
  REPLACEMENT,
  assertOwner,
  WORD_SQL,
  OUTBOX_SQL,
  DELIVERY_SQL,
} from './dictionaryImportSync.fixture'
import type { DictionaryImportRecoveryState } from '@woordenaar/domain'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
const response = (data: unknown) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
})
const rpc = supabase.rpc as unknown as jest.Mock<
  Promise<ReturnType<typeof response>>,
  [string, unknown]
>
let fixture: ReturnType<typeof openImportFixture>
let request: Awaited<ReturnType<ReturnType<typeof openImportFixture>['create']>>
let state: DictionaryImportRecoveryState
beforeEach(async () => {
  jest.clearAllMocks()
  rpc.mockReset()
  Object.assign(supabase.auth, { getUser: jest.fn() })
  jest
    .mocked(supabase.auth.getUser)
    .mockResolvedValue({ data: { user: { id: USER } }, error: null } as Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >)
  fixture = openImportFixture()
  request = await fixture.create()
  state = {
    protocol_version: 1,
    original_operation_id: request.original_intent.operation_id,
    word_id: WORD,
    recovery_version: 0,
    inserted_once: false,
    state: 'uncreated',
    collection_id: null,
  }
  rpc.mockResolvedValue(response(state))
})
afterEach(() => fixture.close())

it('reads a strictly bound current state without mutating any local queue or card', async () => {
  const before = fixture.db.prepare(WORD_SQL).get(WORD)
  const original = await dictionaryImportRepository.getPending(USER)
  const snapshot = await dictionaryImportRecovery.readCurrent(USER, WORD)
  expect(snapshot.state).toEqual(state)
  expect(supabase.rpc).toHaveBeenCalledWith(
    'read_dictionary_import_recovery_v1',
    { p_intent: request.original_intent }
  )
  expect(await dictionaryImportRepository.getPending(USER)).toEqual(original)
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toEqual(before)
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
})

it('explicit recovery and repeated retry use fresh nonces with the same root, personal ID and retained SRS', async () => {
  const content = fixture.db
    .prepare('SELECT * FROM dictionary_card_content')
    .all()
  const commands = fixture.db
    .prepare('SELECT * FROM dictionary_content_commands')
    .all()
  const learning = fixture.db.prepare('SELECT * FROM learning_commands').all()
  const first = await dictionaryImportRecovery.readCurrent(USER, WORD)
  await dictionaryImportRecovery.prepare(first, TARGET, assertOwner)
  const queued = (await recovery.getPending(USER))[0]
  expect(queued.request.original_intent).toEqual(request.original_intent)
  expect(queued.operation_id).not.toBe(request.original_intent.operation_id)
  rpc.mockResolvedValue(response({ ...state, recovery_version: 1 }))
  const second = await dictionaryImportRecovery.readCurrent(USER, WORD)
  await dictionaryImportRecovery.prepare(second, NEXT, assertOwner)
  const replacement = (await recovery.getPending(USER))[0]
  expect(replacement.operation_id).not.toBe(queued.operation_id)
  expect(replacement.request.original_intent).toEqual(request.original_intent)
  expect(JSON.parse(replacement.payload_json)).toMatchObject({
    expected_recovery_version: 1,
    expected_collection_id: null,
    target_collection_id: NEXT,
  })
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    word_id: WORD,
    repetition_count: 7,
    interval_days: 27,
    collection_id: NEXT,
  })
  expect((await dictionaryImportRepository.getPending(USER))[0].intent).toEqual(
    request.original_intent
  )
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.acknowledged_placement_revision
  ).toBeNull()
  expect(
    fixture.db.prepare('SELECT * FROM dictionary_card_content').all()
  ).toEqual(content)
  expect(
    fixture.db.prepare('SELECT * FROM dictionary_content_commands').all()
  ).toEqual(commands)
  expect(fixture.db.prepare('SELECT * FROM learning_commands').all()).toEqual(
    learning
  )
})

it('rejects a proposal superseded after the current-state read, including a cancellation', async () => {
  const snapshot = await dictionaryImportRecovery.readCurrent(USER, WORD)
  await recovery.prepare(
    USER,
    { ...request, operation_id: REPLACEMENT },
    null,
    assertOwner
  )
  await expect(
    dictionaryImportRecovery.prepare(snapshot, NEXT, assertOwner)
  ).rejects.toThrow('changed')
  await cancellation.prepare(USER, WORD, CANCEL, assertOwner)
  await expect(
    dictionaryImportRecovery.prepare(snapshot, NEXT, assertOwner)
  ).rejects.toThrow('changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)?.kind).toBe('cancel')
})

it('rejects a later ordinary local move rather than overwrite it from an open dialog', async () => {
  await dictionaryImportRepository.acceptReceipt(
    USER,
    request.original_intent,
    {
      protocol_version: 1,
      operation_id: request.original_intent.operation_id,
      word_id: WORD,
      outcome: 'inserted',
      existing_word_id: null,
      idempotent: false,
    }
  )
  rpc.mockResolvedValue(
    response({
      ...state,
      inserted_once: true,
      state: 'active',
      collection_id: TARGET,
    })
  )
  const snapshot = await dictionaryImportRecovery.readCurrent(USER, WORD)
  await wordRepository.moveWordToCollection(WORD, USER, NEXT)
  await expect(
    dictionaryImportRecovery.prepare(snapshot, TARGET, assertOwner)
  ).rejects.toThrow('changed')
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.collection_id).toBe(NEXT)
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    kind: 'recovery',
    status: 'pending',
    placement_revision: 1,
  })
})

it('does not publish a read if its local proposal changes while the RPC is in flight', async () => {
  rpc.mockImplementationOnce(async () => {
    await recovery.prepare(USER, request, null, assertOwner)
    return response(state)
  })
  await expect(
    dictionaryImportRecovery.readCurrent(USER, WORD)
  ).rejects.toThrow('changed')
})

it.each(['unavailable', 'cancelled'] as const)(
  'keeps %s identities unavailable rather than recreating them',
  async outcome => {
    rpc.mockResolvedValue(
      response({
        ...state,
        state: outcome,
        inserted_once: true,
        recovery_version: 1,
      })
    )
    const snapshot = await dictionaryImportRecovery.readCurrent(USER, WORD)
    await expect(
      dictionaryImportRecovery.prepare(snapshot, TARGET, assertOwner)
    ).rejects.toThrow('cannot be recovered')
    expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
  }
)

it('rejects malformed/foreign state and missing pre-upgrade provenance without writing or inferring an origin', async () => {
  rpc.mockResolvedValueOnce(response({ ...state, word_id: CANCEL }))
  await expect(
    dictionaryImportRecovery.readCurrent(USER, WORD)
  ).rejects.toThrow('Invalid')
  fixture.db
    .prepare('DELETE FROM dictionary_import_delivery WHERE word_id = ?')
    .run(WORD)
  fixture.db
    .prepare(
      'INSERT INTO dictionary_import_delivery(word_id,user_id) VALUES (?,?)'
    )
    .run(WORD, USER)
  rpc.mockClear()
  await expect(
    dictionaryImportRecovery.readCurrent(USER, WORD)
  ).rejects.toThrow('provenance is unavailable')
  expect(rpc).not.toHaveBeenCalled()
  expect(await view.getIssues(USER)).toEqual([
    { word_id: WORD, issue: 'unverified' },
  ])
})

it('retains pending/conflicting recovery and unverified debt as visible owner-bound issues', async () => {
  expect(await view.getIssues(USER)).toEqual([
    { word_id: WORD, issue: 'pending' },
  ])
  await recovery.prepare(USER, request, null, assertOwner)
  fixture.db
    .prepare(
      "UPDATE dictionary_import_recovery_outbox SET status = 'placement-conflict' WHERE word_id = ?"
    )
    .run(WORD)
  expect(await view.getIssues(USER)).toEqual([
    { word_id: WORD, issue: 'placement-conflict' },
  ])
  expect(await view.getIssues(CANCEL)).toEqual([])
  await cancellation.prepare(USER, WORD, CANCEL, assertOwner)
  expect(await view.getIssues(USER)).toEqual([])
})

it('checks the UI owner inside the transaction and rolls back when its view changes', async () => {
  const snapshot = await dictionaryImportRecovery.readCurrent(USER, WORD)
  let checks = 0
  await expect(
    dictionaryImportRecovery.prepare(snapshot, TARGET, () => {
      if (++checks === 3) throw new Error('View changed')
    })
  ).rejects.toThrow('View changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.local_placement_revision
  ).toBe(0)
})

it('keeps a delivered card reachable for explicit recovery after its target disappears', async () => {
  await dictionaryImportRepository.acceptReceipt(
    USER,
    request.original_intent,
    {
      protocol_version: 1,
      operation_id: request.original_intent.operation_id,
      word_id: WORD,
      outcome: 'inserted',
      existing_word_id: null,
      idempotent: false,
    }
  )
  expect(await view.getIssues(USER)).toEqual([])
  fixture.db
    .prepare('UPDATE words SET collection_id = NULL WHERE word_id = ?')
    .run(WORD)
  expect(await view.getIssues(USER)).toEqual([
    { word_id: WORD, issue: 'target-unavailable' },
  ])
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    repetition_count: 7,
    interval_days: 27,
  })
})

it('rejects an offline state read without changing durable debt and a foreign/missing target without queueing', async () => {
  rpc.mockRejectedValueOnce(new Error('Offline'))
  await expect(
    dictionaryImportRecovery.readCurrent(USER, WORD)
  ).rejects.toThrow('Offline')
  expect(await view.getIssues(USER)).toEqual([
    { word_id: WORD, issue: 'pending' },
  ])
  const snapshot = await dictionaryImportRecovery.readCurrent(USER, WORD)
  await expect(
    dictionaryImportRecovery.prepare(snapshot, CANCEL, assertOwner)
  ).rejects.toThrow('changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.local_placement_revision
  ).toBe(0)
})

it('rejects a current-state reply after sign-out even when the same owner signs back in', async () => {
  jest
    .mocked(supabase.auth.onAuthStateChange)
    .mockImplementationOnce(listener => {
      rpc.mockImplementationOnce(async () => {
        listener('SIGNED_OUT', null)
        listener('SIGNED_IN', { user: { id: USER } } as NonNullable<
          Parameters<typeof listener>[1]
        >)
        return response(state)
      })
      return {
        data: {
          subscription: {
            id: 'recovery-read-watch',
            callback: listener,
            unsubscribe: jest.fn(),
          },
        },
      }
    })
  await expect(
    dictionaryImportRecovery.readCurrent(USER, WORD)
  ).rejects.toThrow('Authentication changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toBeUndefined()
})
