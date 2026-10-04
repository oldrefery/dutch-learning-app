import { supabase } from '@/lib/supabase'
import { prepareImportMetadata } from '../dictionaryImportMetadata'
import { dictionaryImportDeliveryRepository as delivery } from '@/db/dictionaryImportDeliveryRepository'
import { dictionaryImportRepository as imports } from '@/db/dictionaryImportRepository'
import { dictionaryImportRecoveryRepository as recovery } from '@/db/dictionaryImportRecoveryRepository'
import { wordRepository } from '@/db/wordRepository'
import {
  openImportFixture,
  USER,
  WORD,
  TARGET,
  NEXT,
  ORIGINAL,
  assertOwner,
  WORD_SQL,
  DELIVERY_SQL,
} from './dictionaryImportSync.fixture'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
let fixture: ReturnType<typeof openImportFixture>
const remote = (target: string) => ({
  word_id: WORD,
  collection_id: target,
  updated_at: '2026-10-02T10:00:00Z',
  deleted_at: null,
})
const payload = () => [
  { word_id: WORD, user_id: USER, collection_id: ORIGINAL },
]
function lookup(rows: unknown[], during?: () => Promise<void>) {
  const query = {
    eq: jest.fn(),
    in: jest.fn(),
    is: jest.fn(),
    range: jest.fn(async () => {
      await during?.()
      return { data: rows, error: null }
    }),
  }
  for (const method of [query.eq, query.in, query.is])
    method.mockReturnValue(query)
  jest
    .mocked(supabase.from)
    .mockReturnValue({ select: jest.fn(() => query) } as unknown as ReturnType<
      typeof supabase.from
    >)
}
async function acknowledgeOriginal() {
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
      idempotent: true,
    },
    assertOwner
  )
  return request
}
beforeEach(() => {
  fixture = openImportFixture()
  jest.clearAllMocks()
})
afterEach(() => fixture.close())

it('hydrates current owned placement after historical receipt without a metadata write or learning overwrite', async () => {
  await acknowledgeOriginal()
  const before = fixture.db.prepare(WORD_SQL).get(WORD)!
  lookup([remote(NEXT)])
  const result = await prepareImportMetadata(
    payload(),
    await delivery.getAll(USER),
    assertOwner
  )
  expect(result.skipIds.has(WORD)).toBe(true)
  expect(result.acknowledgements).toEqual([
    { word_id: WORD, updated_at: remote(NEXT).updated_at, deleted_at: null },
  ])
  expect(fixture.db.prepare(WORD_SQL).get(WORD)).toEqual({
    ...before,
    collection_id: NEXT,
  })
})

it('gates retained placement debt with no durable base instead of sending an unguarded move', async () => {
  await acknowledgeOriginal()
  fixture.db.exec(
    'UPDATE dictionary_import_delivery SET local_placement_revision = 1'
  )
  fixture.db
    .prepare("UPDATE words SET collection_id = ?,sync_status = 'pending'")
    .run(TARGET)
  lookup([remote(NEXT)])
  await expect(
    prepareImportMetadata(payload(), await delivery.getAll(USER), assertOwner)
  ).rejects.toThrow('Saved imports')
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.collection_id).toBe(TARGET)
  expect(await delivery.getDebtWordIds(USER)).toEqual([WORD])
})

it('rejects an explicit move racing placement hydration and preserves its pending revision', async () => {
  await acknowledgeOriginal()
  const snapshot = await delivery.getAll(USER)
  lookup([remote(NEXT)], () =>
    wordRepository.moveWordToCollection(WORD, USER, TARGET)
  )
  await expect(
    prepareImportMetadata(payload(), snapshot, assertOwner)
  ).rejects.toThrow('changed')
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.collection_id).toBe(TARGET)
  expect(await delivery.getDebtWordIds(USER)).toEqual([WORD])
})

it('does not fabricate delivery from v15-only provenance, or recreate a missing imported identity', async () => {
  await acknowledgeOriginal()
  fixture.db.exec(
    'DROP TRIGGER protect_dictionary_import_delivery_origin; UPDATE dictionary_import_delivery SET original_intent_json = NULL'
  )
  lookup([remote(NEXT)])
  await expect(
    prepareImportMetadata(payload(), await delivery.getAll(USER), assertOwner)
  ).rejects.toThrow('unverified')
  lookup([])
  await expect(
    prepareImportMetadata(payload(), await delivery.getAll(USER), assertOwner)
  ).rejects.toThrow('unavailable')
})

it('rolls back owner changes during placement hydration and ignores a newer queued recovery', async () => {
  const request = await acknowledgeOriginal()
  const snapshot = await delivery.getAll(USER)
  lookup([remote(NEXT)])
  let checks = 0
  await expect(
    prepareImportMetadata(payload(), snapshot, () => {
      if (++checks === 4) throw new Error('Owner changed')
    })
  ).rejects.toThrow('Owner changed')
  expect(fixture.db.prepare(WORD_SQL).get(WORD)?.collection_id).toBe(ORIGINAL)
  await recovery.prepare(USER, request, null, assertOwner)
  await expect(
    delivery.hydrateDeliveredPlacement(USER, WORD, 0, NEXT, assertOwner)
  ).rejects.toThrow('changed')
  expect(fixture.db.prepare(DELIVERY_SQL).get(WORD)).toMatchObject({
    local_placement_revision: 1,
    acknowledged_placement_revision: 0,
  })
})
