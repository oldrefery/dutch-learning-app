/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import {
  loadSharedCollectionRows,
  getSharedCollectionImportContext,
  loadSharedFollowingCollection,
} from './repository'
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

const followingFlags = [
  'DICTIONARY_FOLLOWING_ENABLED',
  'NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED',
] as const
const initialFlags = new Map(followingFlags.map(key => [key, process.env[key]]))
afterEach(() => {
  for (const key of followingFlags) {
    const value = initialFlags.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})
it('uses v2 and only the destination owner collections in following context, keeping every original ID', async () => {
  for (const key of followingFlags) process.env[key] = 'true'
  const v2 = {
    ...shared,
    schema_version: 2,
    words: shared.words.map(({ content, word_id }) => ({
      content,
      word_id,
      shared_reference: null,
    })),
  }
  rpc.mockResolvedValue({ data: v2, error: null })
  const select = jest.fn()
  const eq = jest.fn()
  const order = jest.fn().mockResolvedValue({
    data: [{ collection_id: shared.collection.collection_id, name: 'Owned' }],
    error: null,
  })
  from.mockReturnValue({ select })
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ order })
  const result = await getSharedCollectionImportContext(token, token)
  expect(result?.followingShared).toEqual(v2)
  expect(result?.previewWords).toEqual([])
  expect(rpc).toHaveBeenCalledWith('get_shared_dictionary_collection_v2', {
    p_share_token: token,
  })
  expect(from.mock.calls).toEqual([['collections']])
  expect(eq).toHaveBeenCalledWith('user_id', token)
})
it('never downgrades a revoked/unavailable v2 share and rejects v1 responses', async () => {
  for (const key of followingFlags) process.env[key] = 'true'
  rpc.mockResolvedValueOnce({ data: null, error: null })
  await expect(
    getSharedCollectionImportContext(token, token)
  ).resolves.toBeNull()
  rpc.mockResolvedValueOnce({ data: null, error: new Error('Offline') })
  await expect(loadSharedFollowingCollection(token)).rejects.toThrow(
    'Could not load'
  )
  rpc.mockResolvedValueOnce({ data: shared, error: null })
  await expect(loadSharedFollowingCollection(token)).rejects.toThrow()
  expect(rpc.mock.calls.map(call => call[0])).toEqual(
    Array(3).fill('get_shared_dictionary_collection_v2')
  )
  expect(from).not.toHaveBeenCalled()
})
