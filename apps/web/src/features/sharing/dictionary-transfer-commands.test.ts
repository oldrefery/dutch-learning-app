/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { revalidatePath } from 'next/cache'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { hydrateOwnedWords } from '@/features/dictionary/repository'
import { executeDictionaryTransfer } from './dictionary-transfer-commands'
import {
  content,
  document,
  importCommand,
  OWNER,
  OTHER_OWNER,
  TARGET,
  WORD,
} from './__fixtures__/dictionary-transfer'

jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/fetch-all-rows', () => ({ fetchAllRows: jest.fn() }))
jest.mock('@/features/dictionary/repository', () => ({
  ...jest.requireActual('@/features/dictionary/repository'),
  hydrateOwnedWords: jest.fn(),
}))
const row = {
  word_id: WORD,
  user_id: OWNER,
  dutch_lemma: content.dutch_lemma,
  part_of_speech: content.part_of_speech,
  article: content.article,
  collection_id: TARGET,
}
const query = {
  select: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  maybeSingle: jest.fn(),
}
const rpc = jest.fn()
const client = { from: jest.fn(() => query), rpc }
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  client.from.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({
    data: { collection_id: TARGET, name: 'Owned' },
    error: null,
  })
  query.order.mockResolvedValue({
    data: [{ collection_id: TARGET, name: 'Owned' }],
    error: null,
  })
  jest.mocked(fetchAllRows).mockResolvedValue({ data: [], error: null })
  jest.mocked(hydrateOwnedWords).mockResolvedValue([])
  rpc.mockResolvedValue({ data: [row], error: null })
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})
const execute = (command = importCommand) =>
  executeDictionaryTransfer(client as never, OWNER, command)

it('imports only selected content into an existing owned target, without an access-level write gate', async () => {
  expect(await execute()).toMatchObject({
    status: 'saved',
    savedCount: 1,
    skippedCount: 0,
  })
  expect(query.eq).toHaveBeenCalledWith('user_id', OWNER)
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('import_dictionary_copies_v1', {
    p_collection_id: TARGET,
    p_contents: [content],
  })
  expect(revalidatePath).toHaveBeenCalledWith('/app/dictionary-import')
})
it('exports through the strict self-contained helper without publishing', async () => {
  rpc.mockResolvedValue({ data: document, error: null })
  const result = await executeDictionaryTransfer(client as never, OWNER, {
    kind: 'export',
    ownerId: OWNER,
    collectionId: TARGET,
  })
  expect(result).toEqual({ status: 'exported', ownerId: OWNER, document })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('export_dictionary_collection_v1', {
    p_collection_id: TARGET,
  })
})
it('refuses owner changes before any collection access', async () => {
  expect(
    await execute({ ...importCommand, ownerId: OTHER_OWNER })
  ).toMatchObject({ status: 'error' })
  expect(client.from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})
it.each(['missing', 'query-error', 'deleted-after-read'])(
  'does not create or retarget an unavailable target: %s',
  async mode => {
    if (mode === 'deleted-after-read')
      query.order.mockResolvedValue({ data: [], error: null })
    else
      query.maybeSingle.mockResolvedValue({
        data: null,
        error: mode === 'query-error' ? {} : null,
      })
    expect(await execute()).toMatchObject({ status: 'error' })
    expect(rpc).not.toHaveBeenCalled()
  }
)
it('rechecks hydrated global duplicates and skips them without moving or resetting SRS', async () => {
  jest
    .mocked(hydrateOwnedWords)
    .mockResolvedValue([{ ...row, collection_id: null }] as never)
  expect(await execute()).toMatchObject({
    status: 'saved',
    savedCount: 0,
    skippedCount: 1,
  })
  expect(rpc).not.toHaveBeenCalled()
})
it('removes within-document duplicates before the RPC', async () => {
  expect(
    await execute({
      ...importCommand,
      document: {
        ...document,
        entries: [...document.entries, ...document.entries],
      },
      selectedIndexes: [0, 1],
    })
  ).toMatchObject({ savedCount: 1, skippedCount: 1 })
  expect(rpc).toHaveBeenCalledWith('import_dictionary_copies_v1', {
    p_collection_id: TARGET,
    p_contents: [content],
  })
})
it('reports concurrent existing cards as saved without claiming they are new or moving them', async () => {
  rpc.mockResolvedValue({
    data: [{ ...row, collection_id: 'elsewhere' }],
    error: null,
  })
  expect(await execute()).toMatchObject({ status: 'saved', savedCount: 1 })
  expect(rpc).toHaveBeenCalledTimes(1)
})
it.each(['reply-error', 'throw'])(
  'keeps a lost mutation response uncertain and never replays: %s',
  async mode => {
    if (mode === 'throw') rpc.mockRejectedValue(new Error('Lost reply'))
    else rpc.mockResolvedValue({ data: null, error: { message: 'Lost reply' } })
    expect(await execute()).toMatchObject({ status: 'uncertain' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(revalidatePath).not.toHaveBeenCalled()
  }
)
it('retains saved success when cache invalidation fails', async () => {
  jest.mocked(revalidatePath).mockImplementation(() => {
    throw new Error('Cache unavailable')
  })
  expect(await execute()).toMatchObject({
    status: 'saved',
    savedCount: 1,
    cacheRefreshed: false,
  })
  expect(rpc).toHaveBeenCalledTimes(1)
})
it.each([
  null,
  [],
  [{ ...row, user_id: OTHER_OWNER }],
  [{ ...row, dutch_lemma: 'unrequested' }],
  [row, row],
])(
  'preserves committed success but does not invent a verified count from an invalid receipt',
  async data => {
    rpc.mockResolvedValue({ data, error: null })
    expect(await execute()).toMatchObject({ status: 'saved', savedCount: null })
    expect(rpc).toHaveBeenCalledTimes(1)
  }
)
