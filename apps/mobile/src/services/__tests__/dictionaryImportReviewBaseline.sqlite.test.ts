import { supabase } from '@/lib/supabase'
import { dictionaryImportRepository as imports } from '@/db/dictionaryImportRepository'
import { dictionaryImportCancellationRepository as cancellation } from '@/db/dictionaryImportCancellationRepository'
import { wordRepository } from '@/db/wordRepository'
import { getLastSyncTimestamp, isNetworkAvailable } from '@/utils/network'
import { SyncManager } from '../syncManager'
import { syncStatusService } from '../syncStatusService'
import {
  openImportFixture,
  USER,
  WORD,
  TARGET,
  NEXT,
  ORIGINAL,
  CANCEL,
  assertOwner,
  DELIVERY_SQL,
} from './dictionaryImportSync.fixture'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')
jest.mock('@/lib/sentry')
jest.mock('@/utils/network')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))

// Checkpoint 6 review counterexamples against b7f207c. Passing means the unsafe
// behavior was reproduced. Convert these to safety regressions during repair.
let fixture: ReturnType<typeof openImportFixture>
beforeEach(() => {
  jest.clearAllMocks()
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

it('review baseline: cancellation ACK hides the still pending normal tombstone', async () => {
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
  expect(await wordRepository.getDeletedWords(USER)).toHaveLength(1)
  expect((await syncStatusService.getSnapshot(USER)).totalPending).toBe(0)
})

it('review baseline: supported metadata delivery overwrites a newer remote placement and acknowledges it', async () => {
  await acknowledgedImport()
  await wordRepository.moveWordToCollection(WORD, USER, TARGET)
  let remotePlacement = ORIGINAL
  const placementsBeforeWrite: string[] = []
  const acknowledgement = {
    word_id: WORD,
    updated_at: '2026-10-02T10:01:00Z',
    deleted_at: null,
  }
  const query = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    range: jest.fn(async () => ({
      data: [{ ...acknowledgement, collection_id: remotePlacement }],
      error: null,
    })),
  }
  const write = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    select: jest.fn(async () => ({ data: [acknowledgement], error: null })),
  }
  const update = jest.fn((value: { collection_id: string }) => {
    // Another device has now completed recovery after the placement read.
    remotePlacement = NEXT
    placementsBeforeWrite.push(remotePlacement)
    remotePlacement = value.collection_id
    return write
  })
  jest.mocked(supabase.from).mockReturnValue({
    select: jest.fn(() => query),
    update,
  } as unknown as ReturnType<typeof supabase.from>)
  const manager = new SyncManager() as unknown as {
    executeDictionaryWordMetadataUpsert(
      payloads: {
        word_id: string
        user_id: string
        collection_id: string
      }[]
    ): Promise<{ error: unknown }>
  }
  const result = await manager.executeDictionaryWordMetadataUpsert([
    { word_id: WORD, user_id: USER, collection_id: TARGET },
  ])
  expect(result.error).toBeNull()
  expect(update).toHaveBeenCalledTimes(1)
  expect(write.eq.mock.calls).toEqual([['user_id', USER]])
  expect(placementsBeforeWrite).toEqual([NEXT])
  expect(remotePlacement).toBe(TARGET)
  expect(fixture.db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    local_placement_revision: 1,
    acknowledged_placement_revision: 1,
  })
})
