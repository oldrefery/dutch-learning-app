/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { loadSharedCollectionRows } from './repository'
import { createClient } from '@/lib/supabase/server'
import { officialEntryToDictionaryContent } from '@woordenaar/content/dictionary'
import { validateOfficialContentManifest } from '@woordenaar/content/manifest'
import bundled from '@woordenaar/content'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const rpc = jest.fn()
const from = jest.fn()
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
const token = '10000000-0000-4000-8000-000000000001'
const manifest = validateOfficialContentManifest(bundled)
if (!manifest.success) throw new Error('Invalid fixture')
const content = officialEntryToDictionaryContent(manifest.data.entries[0])
const shared = {
  schema_version: 1,
  collection: {
    collection_id: '20000000-0000-4000-8000-000000000001',
    name: 'Explicit share',
  },
  words: [
    {
      word_id: '30000000-0000-4000-8000-000000000001',
      created_at: '2026-10-02T06:00:00Z',
      content,
    },
  ],
}
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  jest.mocked(createClient).mockResolvedValue({ rpc, from } as never)
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})

it('loads the recipient-authorized projection in one RPC without private source metadata', async () => {
  rpc.mockResolvedValue({ data: shared, error: null })
  await expect(loadSharedCollectionRows(token)).resolves.toEqual({
    collection: shared.collection,
    words: [
      {
        ...content,
        word_id: shared.words[0].word_id,
        created_at: shared.words[0].created_at,
      },
    ],
  })
  expect(rpc).toHaveBeenCalledWith('get_shared_dictionary_collection_v1', {
    p_share_token: token,
  })
  expect(from).not.toHaveBeenCalled()
})
it('returns absent shares and rejects malformed or unavailable responses without a legacy downgrade', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: null })
  await expect(loadSharedCollectionRows(token)).resolves.toBeNull()
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'unsupported-protocol' },
  })
  await expect(loadSharedCollectionRows(token)).rejects.toThrow(
    'Could not load'
  )
  rpc.mockResolvedValueOnce({
    data: { ...shared, private_owner: 'secret' },
    error: null,
  })
  await expect(loadSharedCollectionRows(token)).rejects.toThrow(
    'Invalid dictionary collection transfer'
  )
  expect(from).not.toHaveBeenCalled()
})
