import { lookupPublishedMeanings } from '../dictionaryMeaningLookup'
import { supabase } from '@/lib/supabase'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { transferRevision } from '@/db/__tests__/dictionaryFollowingTransfer.fixture'
import { OWNER_A, OWNER_B } from '@/db/__tests__/dictionaryFollowing.fixture'
import {
  DICTIONARY_MEANING_ENTRY_COLUMNS,
  DICTIONARY_MEANING_HEAD_COLUMNS,
  DICTIONARY_TRANSFER_REVISION_COLUMNS,
} from '@woordenaar/domain'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn(), onAuthStateChange: jest.fn() },
  },
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryFollowingImportsEnabled: jest.fn(),
}))
const ENTRY = transferRevision.entry_id
const REVISION = transferRevision.revision_id
const CAPABILITY = {
  dictionary_content_protocol: 2,
  read_protocol_versions: [1, 2],
  command_protocol_versions: [2],
  following_enabled: true,
  shared_analysis_enabled: false,
}
const result = (data: unknown) => ({ data, error: null as unknown })
const rows = () => ({
  dictionary_entries: result([
    {
      entry_id: ENTRY,
      lemma: 'huis',
      language_code: 'nl',
      state: 'published',
      sense_key: 'sense-1',
      part_of_speech: transferRevision.content.part_of_speech,
      article: transferRevision.content.article,
    },
  ]),
  dictionary_entry_heads: result([{ entry_id: ENTRY, revision_id: REVISION }]),
  dictionary_revisions: result([transferRevision]),
})
let responses: ReturnType<typeof rows>
let callback: (event: string, session: { user: { id: string } } | null) => void
const unsubscribe = jest.fn()
const getUser = jest.fn()
const rpc = jest.fn()
const queries: {
  table: string
  select: jest.Mock
  eq: jest.Mock
  in: jest.Mock
  order: jest.Mock
  limit: jest.Mock
}[] = []
const from = jest.fn((table: string) => {
  const query = {
    table,
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(responses[table as keyof typeof responses]).then(resolve),
  }
  queries.push(query)
  return query
})
const guard = jest.fn()
const invoke = () => lookupPublishedMeanings(OWNER_A, ' HUIS ', guard)
beforeEach(() => {
  jest.clearAllMocks()
  responses = rows()
  queries.length = 0
  guard.mockImplementation(() => undefined)
  getUser.mockResolvedValue({ data: { user: { id: OWNER_A } }, error: null })
  rpc.mockResolvedValue(result(CAPABILITY))
  jest.mocked(supabase.from).mockImplementation(from as never)
  jest.mocked(supabase.rpc).mockImplementation(rpc)
  jest.mocked(supabase.auth.getUser).mockImplementation(getUser)
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(((
    fn: typeof callback
  ) => {
    callback = fn as typeof callback
    return { data: { subscription: { unsubscribe } } }
  }) as never)
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(true)
})
it('uses authenticated exact published candidate/head/revision reads with a bounded query and no writes', async () => {
  const document = await invoke()
  expect(document.entries[0].shared_reference?.reference).toEqual({
    entry_id: ENTRY,
    revision_id: REVISION,
  })
  expect(rpc).toHaveBeenCalledWith('dictionary_content_capability_v2')
  expect(from.mock.calls.map(call => call[0])).toEqual([
    'dictionary_entries',
    'dictionary_entry_heads',
    'dictionary_revisions',
  ])
  expect(queries[0].select).toHaveBeenCalledWith(
    DICTIONARY_MEANING_ENTRY_COLUMNS
  )
  expect(queries[0].eq.mock.calls).toEqual([
    ['language_code', 'nl'],
    ['lemma', 'huis'],
    ['state', 'published'],
  ])
  expect(queries[0].order).toHaveBeenCalledWith('entry_id')
  expect(queries[0].limit).toHaveBeenCalledWith(101)
  expect(queries[1].select).toHaveBeenCalledWith(
    DICTIONARY_MEANING_HEAD_COLUMNS
  )
  expect(queries[1].in).toHaveBeenCalledWith('entry_id', [ENTRY])
  expect(queries[2].select).toHaveBeenCalledWith(
    DICTIONARY_TRANSFER_REVISION_COLUMNS
  )
  expect(queries[2].in).toHaveBeenCalledWith('revision_id', [REVISION])
  expect(queries[2].eq).toHaveBeenCalledWith('review_status', 'published')
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})
it('rejects an unavailable gate or invalidated input before reading capability', async () => {
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(false)
  await expect(invoke()).rejects.toThrow('unavailable')
  expect(rpc).not.toHaveBeenCalled()
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(true)
  guard.mockImplementation(() => {
    throw new Error('Input changed')
  })
  await expect(invoke()).rejects.toThrow('Input changed')
  expect(from).not.toHaveBeenCalled()
})
it('refuses a different fresh owner before reads', async () => {
  getUser.mockResolvedValue({ data: { user: { id: OWNER_B } }, error: null })
  await expect(invoke()).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})
it('detects Auth ABA while a read is pending and unsubscribes without returning candidates', async () => {
  rpc.mockImplementation(async () => {
    callback('SIGNED_IN', { user: { id: OWNER_B } })
    callback('SIGNED_IN', { user: { id: OWNER_A } })
    return result(CAPABILITY)
  })
  await expect(invoke()).rejects.toThrow()
  expect(from).not.toHaveBeenCalled()
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})
it('keeps query failures distinct from an empty lookup, including offline Auth', async () => {
  responses.dictionary_entries = {
    data: null,
    error: new Error('RLS query failed'),
  }
  await expect(invoke()).rejects.toThrow('RLS query failed')
  expect(queries).toHaveLength(1)
  getUser.mockResolvedValue({
    data: { user: null },
    error: new Error('Offline'),
  })
  await expect(invoke()).rejects.toThrow()
  expect(queries).toHaveLength(1)
})
