import {
  collectionSharingService,
  CollectionSharingError,
} from '../collectionSharingService'
import { supabase } from '@/lib/supabase'
import { officialEntryToDictionaryContent } from '@woordenaar/content/dictionary'
import { loadOfficialDutchA1Pack } from '../starterPackService'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}))
jest.mock('@/lib/sentry')
jest.mock('@/utils/logger')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))

const collectionId = '10000000-0000-4000-8000-000000000001'
const wordId = '20000000-0000-4000-8000-000000000001'
const token = '30000000-0000-4000-8000-000000000001'
const at = '2026-10-02T06:00:00Z'
const content = officialEntryToDictionaryContent(
  loadOfficialDutchA1Pack().entries[0]
)
const shared = {
  schema_version: 1,
  collection: { collection_id: collectionId, name: 'Explicit share' },
  words: [{ word_id: wordId, created_at: at, content }],
}

beforeEach(() => {
  jest.clearAllMocks()
  jest
    .spyOn(collectionSharingService, 'getSharedCollection')
    .mockResolvedValue({
      success: true,
      data: {
        ...shared.collection,
        is_shared: true,
        share_token: token,
        shared_at: at,
        word_count: 1,
      },
    })
})
afterEach(() => jest.restoreAllMocks())

it('uses only the recipient-authorized content projection for enabled imports', async () => {
  jest
    .mocked(supabase.rpc)
    .mockResolvedValue({ data: shared, error: null } as never)
  const result = await collectionSharingService.getSharedCollectionWords(token)
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.words[0]).toMatchObject({
      word_id: wordId,
      translations: content.translations,
    })
    for (const key of [
      'user_id',
      'revision_id',
      'entry_id',
      'interval_days',
      'repetition_count',
    ]) {
      expect(result.data.words[0]).not.toHaveProperty(key)
    }
  }
  expect(supabase.rpc).toHaveBeenCalledWith(
    'get_shared_dictionary_collection_v1',
    { p_share_token: token }
  )
  expect(supabase.from).not.toHaveBeenCalled()
})

it('rejects a changed share identity or private metadata without a legacy fallback', async () => {
  jest.mocked(supabase.rpc).mockResolvedValueOnce({
    data: {
      ...shared,
      collection: { ...shared.collection, collection_id: wordId },
    },
    error: null,
  } as never)
  expect(
    await collectionSharingService.getSharedCollectionWords(token)
  ).toEqual({ success: false, error: CollectionSharingError.UNKNOWN_ERROR })
  jest.mocked(supabase.rpc).mockResolvedValueOnce({
    data: { ...shared, private_owner: 'hidden' },
    error: null,
  } as never)
  expect(
    await collectionSharingService.getSharedCollectionWords(token)
  ).toEqual({ success: false, error: CollectionSharingError.UNKNOWN_ERROR })
  expect(supabase.from).not.toHaveBeenCalled()
})

it('stops when the share is revoked after loading its summary', async () => {
  jest
    .mocked(supabase.rpc)
    .mockResolvedValue({ data: null, error: null } as never)
  expect(
    await collectionSharingService.getSharedCollectionWords(token)
  ).toEqual({ success: false, error: CollectionSharingError.NOT_SHARED })
  expect(supabase.from).not.toHaveBeenCalled()
})
