/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { prepareSharedFollowingImport } from './shared-following-import'
import { createClient } from '@/lib/supabase/client'
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const invoke = (token = TOKEN) =>
  prepareSharedFollowingImport(TRANSFER_OWNER, token, original(), true, guard)
import {
  sharedCollectionFollowingSource,
  verifySharedCollectionFollowingSource,
  planDictionaryFollowingTransfer,
  parseFollowingTransferSession,
  type SharedDictionaryCollectionV2,
} from '@woordenaar/domain'
import {
  TRANSFER_OWNER,
  TRANSFER_OTHER,
  TRANSFER_OPERATION,
  TRANSFER_WORD,
  transferSession,
  transferRevision,
} from './__fixtures__/following-transfer'
const TOKEN = '81818181-8181-4181-8181-818181818181'
const WORD_IDS = [1, 2, 3, 4].map(
  index => `90909090-9090-4090-8090-${String(index).padStart(12, '0')}`
)
const original = (): SharedDictionaryCollectionV2 => ({
  schema_version: 2,
  collection: {
    collection_id: TRANSFER_OTHER,
    name: transferSession().document.collection.name,
  },
  words: transferSession().document.entries.map((entry, index) => ({
    ...entry,
    word_id: WORD_IDS[index],
  })),
})
const rpc = jest.fn()
const getUser = jest.fn()
const unsubscribe = jest.fn()
let callback: (event: string, session: { user: { id: string } } | null) => void
const onAuthStateChange = jest.fn((fn: typeof callback) => {
  callback = fn
  return { data: { subscription: { unsubscribe } } }
})
let current = true
const guard = () => {
  if (!current) throw new Error('Unmounted')
}
beforeEach(() => {
  jest.clearAllMocks()
  current = true
  getUser.mockResolvedValue({
    data: { user: { id: TRANSFER_OWNER } },
    error: null,
  })
  rpc.mockResolvedValue({ data: original(), error: null })
  process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
  jest
    .mocked(createClient)
    .mockReturnValue({ rpc, auth: { getUser, onAuthStateChange } } as never)
})
it('reads only the explicit token through v2 and preserves the whole original without personal writes', async () => {
  const result = await invoke()
  expect(result).toEqual(sharedCollectionFollowingSource(TOKEN, original()))
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('get_shared_dictionary_collection_v2', {
    p_share_token: TOKEN,
  })
  expect(getUser).toHaveBeenCalledTimes(2)
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})
it.each([
  ['revoked', null],
  ['v1', { ...original(), schema_version: 1 }],
  ['private metadata', { ...original(), user_id: TRANSFER_OTHER }],
  [
    'wrong collection',
    {
      ...original(),
      collection: { ...original().collection, collection_id: TRANSFER_OWNER },
    },
  ],
  ['changed IDs', { ...original(), words: original().words.slice().reverse() }],
  [
    'changed meaning',
    {
      ...original(),
      words: original().words.map((word, index) =>
        index === 0
          ? { ...word, content: { ...word.content, dutch_lemma: 'different' } }
          : word
      ),
    },
  ],
  [
    'changed reference',
    {
      ...original(),
      words: original().words.map(word => ({
        ...word,
        shared_reference: null,
      })),
    },
  ],
])('rejects %s without a v1/private fallback', async (_reason, data) => {
  rpc.mockResolvedValue({ data, error: null })
  await expect(invoke()).rejects.toThrow()
  expect(rpc.mock.calls.map(call => call[0])).toEqual([
    'get_shared_dictionary_collection_v2',
  ])
})
it('preserves an RPC error and refuses malformed tokens before reading', async () => {
  rpc.mockResolvedValue({ data: null, error: new Error('Offline') })
  await expect(invoke()).rejects.toThrow('Offline')
  rpc.mockClear()
  await expect(invoke('bad-token')).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects a foreign owner before reading and a changed owner after reading', async () => {
  getUser.mockResolvedValueOnce({
    data: { user: { id: TRANSFER_OTHER } },
    error: null,
  })
  await expect(invoke()).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
  getUser
    .mockResolvedValueOnce({
      data: { user: { id: TRANSFER_OWNER } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { user: { id: TRANSFER_OTHER } },
      error: null,
    })
  await expect(invoke()).rejects.toThrow()
})
it.each(['ABA', 'unmount', 'gate'] as const)(
  'fences %s during a share read',
  async reason => {
    rpc.mockImplementation(async () => {
      if (reason === 'ABA') {
        callback('SIGNED_OUT', null)
        callback('SIGNED_IN', { user: { id: TRANSFER_OWNER } })
      }
      if (reason === 'unmount') current = false
      if (reason === 'gate')
        process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'false'
      return { data: original(), error: null }
    })
    await expect(invoke()).rejects.toThrow()
  }
)
it('requires creation opt-in before reading', async () => {
  process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'false'
  await expect(invoke()).rejects.toThrow('unavailable')
  expect(rpc).not.toHaveBeenCalled()
})
it('plans only exact published meanings and retains different, unresolved and unselected originals', () => {
  const source = sharedCollectionFollowingSource(TOKEN, original())
  const ids = jest
    .fn()
    .mockReturnValueOnce(TRANSFER_OPERATION)
    .mockReturnValueOnce(TRANSFER_WORD)
  const plan = planDictionaryFollowingTransfer({
    document: source.document,
    collectionId: TRANSFER_OTHER,
    selectedIndexes: [0, 1, 2],
    revisions: [transferRevision],
    createId: ids,
    sharedCollection: source.shared_collection,
  })
  expect(plan.document).toEqual(transferSession().document)
  expect(plan.review).toEqual([
    { index: 1, reason: 'content-difference' },
    { index: 2, reason: 'unresolved-reference' },
  ])
  expect(plan.intents).toHaveLength(1)
  expect(plan.intents[0].intent.source).toMatchObject({
    kind: 'shared-collection',
    share_token: TOKEN,
    word_id: WORD_IDS[0],
  })
  expect(plan.intents[0].intent.word_id).not.toBe(WORD_IDS[0])
  expect(ids).toHaveBeenCalledTimes(2)
})
it('rejects ambiguous, duplicate and incomplete provenance, and tampered planned source IDs', () => {
  const source = sharedCollectionFollowingSource(TOKEN, original())
  const draft = { ...transferSession(), ...source }
  expect(parseFollowingTransferSession(draft)).toEqual(draft)
  for (const shared_collection of [
    { ...source.shared_collection, word_ids: WORD_IDS.slice(1) },
    { ...source.shared_collection, word_ids: WORD_IDS.map(() => WORD_IDS[0]) },
    { ...source.shared_collection, share_token: 'invalid' },
    { ...source.shared_collection, owner: TRANSFER_OTHER },
  ])
    expect(() =>
      parseFollowingTransferSession({ ...draft, shared_collection })
    ).toThrow()
  expect(() =>
    parseFollowingTransferSession({
      ...draft,
      official_pack: {
        pack_id: 'pack',
        version: '1',
        manifest_sha256: 'a'.repeat(64),
        entry_ids: ['1', '2', '3', '4'],
      },
    })
  ).toThrow()
  expect(() =>
    verifySharedCollectionFollowingSource(TOKEN, original(), {
      ...original(),
      words: [...original().words, original().words[0]],
    })
  ).toThrow()
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
})
