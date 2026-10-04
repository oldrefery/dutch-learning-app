import { supabase } from '@/lib/supabase'
import { dictionaryImportRecoveryRepository as recovery } from '@/db/dictionaryImportRecoveryRepository'
import { dictionaryImportCancellationRepository as cancellation } from '@/db/dictionaryImportCancellationRepository'
import { dictionaryImportSync } from '../dictionaryImportSync'
import {
  dictionaryImportRecoverySync,
  DictionaryImportRecoveryError,
} from '../dictionaryImportRecoverySync'
import {
  openImportFixture,
  USER,
  WORD,
  SECOND,
  CANCEL,
  REPLACEMENT,
  NEXT,
  assertOwner,
  WORD_SQL,
  DELIVERY_SQL,
  OUTBOX_SQL,
} from './dictionaryImportSync.fixture'
import type {
  DictionaryImportRecovery,
  DictionaryImportRecoveryReceipt,
} from '@woordenaar/domain'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
const LOST_REPLY = 'Lost reply'
const response = (data: unknown) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
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
  recovery_version: 1,
  idempotent: true,
})
const STATE_CONFLICT = 'state-conflict'
const rpc = supabase.rpc as unknown as jest.Mock<
  Promise<ReturnType<typeof response>>,
  [string, unknown]
>
let fixture: ReturnType<typeof openImportFixture>
beforeEach(() => {
  jest.clearAllMocks()
  rpc.mockReset()
  Object.assign(supabase.auth, { getUser: jest.fn() })
  fixture = openImportFixture()
  jest
    .mocked(supabase.auth.getUser)
    .mockResolvedValue({ data: { user: { id: USER } }, error: null } as Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >)
})
afterEach(() => fixture.close())

it('replays recovery after a lost reply with identical nonce and source, never delivering the old original', async () => {
  const request = await fixture.create()
  await recovery.prepare(USER, request, null, assertOwner)
  jest
    .mocked(supabase.rpc)
    .mockRejectedValueOnce(new Error(LOST_REPLY))
    .mockResolvedValueOnce(response(receipt(request)))
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(LOST_REPLY)
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)?.payload_json).toBe(
    JSON.stringify(request)
  )
  await expect(dictionaryImportSync.push(USER)).resolves.toBe(1)
  expect(supabase.rpc).toHaveBeenNthCalledWith(
    1,
    'recover_dictionary_import_v1',
    { p_request: request }
  )
  expect(supabase.rpc).toHaveBeenNthCalledWith(
    2,
    'recover_dictionary_import_v1',
    { p_request: request }
  )
  expect(fixture.db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    acknowledged_placement_revision: 1,
  })
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toMatchObject({
    repetition_count: 7,
    interval_days: 27,
  })
})

it('delivers cancellation before recovery and retains its nonce after a lost cancellation reply', async () => {
  await fixture.create()
  const cancel = await cancellation.prepare(USER, WORD, CANCEL, assertOwner)
  const request = await fixture.create(SECOND)
  await recovery.prepare(
    USER,
    { ...request, operation_id: REPLACEMENT },
    null,
    assertOwner
  )
  jest
    .mocked(supabase.rpc)
    .mockRejectedValueOnce(new Error(LOST_REPLY))
    .mockResolvedValueOnce(
      response({
        protocol_version: 1,
        operation_id: CANCEL,
        original_operation_id: cancel.original_intent.operation_id,
        word_id: WORD,
        outcome: 'cancelled',
        recovery_version: 1,
        idempotent: true,
      })
    )
  await expect(dictionaryImportRecoverySync.push(USER, true)).rejects.toThrow(
    LOST_REPLY
  )
  await expect(dictionaryImportRecoverySync.push(USER, true)).resolves.toBe(1)
  expect(supabase.rpc).toHaveBeenNthCalledWith(
    1,
    'cancel_dictionary_import_v1',
    { p_request: cancel }
  )
  expect(supabase.rpc).toHaveBeenNthCalledWith(
    2,
    'cancel_dictionary_import_v1',
    { p_request: cancel }
  )
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.deleted_at).toBeTruthy()
  expect(fixture.db.prepare(OUTBOX_SQL).get(SECOND)).toMatchObject({
    status: 'pending',
  })
})

it('retains typed nonmutating conflicts without rebasing or releasing dependent delivery', async () => {
  const request = await fixture.create()
  await recovery.prepare(USER, request, null, assertOwner)
  // Nonmutating results have a different strict shape.
  const {
    recovery_version: _version,
    idempotent: _idempotent,
    existing_word_id: _existing,
    ...identity
  } = receipt(request)
  jest.mocked(supabase.rpc).mockResolvedValue(
    response({
      ...identity,
      outcome: STATE_CONFLICT,
      state: {
        protocol_version: 1,
        original_operation_id: request.original_intent.operation_id,
        word_id: WORD,
        recovery_version: 2,
        inserted_once: true,
        state: 'active',
        collection_id: NEXT,
      },
    })
  )
  await expect(dictionaryImportSync.push(USER)).rejects.toBeInstanceOf(
    DictionaryImportRecoveryError
  )
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    status: STATE_CONFLICT,
    payload_json: JSON.stringify(request),
  })
  rpc.mockClear()
  await expect(dictionaryImportSync.push(USER)).rejects.toBeInstanceOf(
    DictionaryImportRecoveryError
  )
  expect(supabase.rpc).not.toHaveBeenCalled()
})

it('ignores old recovery success after proposal replacement and aborts the dependent phase', async () => {
  const request = await fixture.create()
  await recovery.prepare(USER, request, null, assertOwner)
  const next = {
    ...request,
    operation_id: REPLACEMENT,
    target_collection_id: NEXT,
  }
  rpc.mockImplementationOnce(async () => {
    await recovery.prepare(USER, next, request.operation_id, assertOwner)
    return response(receipt(request))
  })
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow('changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    status: 'pending',
    payload_json: JSON.stringify(next),
  })
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.collection_id).toBe(NEXT)
})

it('does not acknowledge recovery under a changed account', async () => {
  const request = await fixture.create()
  await recovery.prepare(USER, request, null, assertOwner)
  rpc.mockImplementationOnce(async () => {
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'other-owner' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    return response(receipt(request))
  })
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(
    'Authentication changed'
  )
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)?.status).toBe('pending')
  expect(
    fixture.db.prepare(DELIVERY_SQL).get(WORD)?.acknowledged_placement_revision
  ).toBeNull()
})

it('rejects a sign-out during delivery even if the same owner immediately signs back in', async () => {
  const request = await fixture.create()
  await recovery.prepare(USER, request, null, assertOwner)
  jest
    .mocked(supabase.auth.onAuthStateChange)
    .mockImplementationOnce(listener => {
      rpc.mockImplementationOnce(async () => {
        listener('SIGNED_OUT', null)
        return response(receipt(request))
      })
      return {
        data: {
          subscription: {
            id: 'test-owner-watch',
            callback: listener,
            unsubscribe: jest.fn(),
          },
        },
      } as ReturnType<typeof supabase.auth.onAuthStateChange>
    })
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(
    'Authentication changed'
  )
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)?.status).toBe('pending')
})

it('late recovery receipt cannot erase a cancellation queued during its request', async () => {
  const request = await fixture.create()
  await recovery.prepare(USER, request, null, assertOwner)
  rpc.mockImplementationOnce(async () => {
    await cancellation.prepare(USER, WORD, CANCEL, assertOwner)
    return response(receipt(request))
  })
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow('changed')
  expect(fixture.db.prepare(OUTBOX_SQL).get(WORD)).toMatchObject({
    kind: 'cancel',
    status: 'pending',
  })
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.deleted_at).toBeTruthy()
})
