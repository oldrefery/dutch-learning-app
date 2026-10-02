/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@woordenaar/supabase-contracts'
import { parseDictionaryContent } from '@woordenaar/domain'
import { importStarterPackEntries } from './dictionary-import'
import { loadOfficialStarterPack } from './starter-pack-domain'

jest.mock('server-only', () => ({}))
const rpc = jest.fn()
const client = { rpc } as unknown as SupabaseClient<Database>
const manifest = loadOfficialStarterPack()
const entries = manifest.entries.slice(0, 2)
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  rpc.mockResolvedValue({ data: [], error: null })
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})

it('requests only pack identity and selected entry IDs, with no client references or learning state', async () => {
  await importStarterPackEntries(client, 'owned', manifest, entries)
  expect(rpc).toHaveBeenCalledWith('import_official_dictionary_pack_v1', {
    p_collection_id: 'owned',
    p_pack_id: manifest.packId,
    p_version: manifest.version,
    p_entry_ids: entries.map(entry => entry.entryId),
  })
})
it('uses complete private copies for unhosted bundled Essentials only', async () => {
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'official-pack-unavailable' },
  })
  await importStarterPackEntries(client, 'owned', manifest, entries)
  const [name, args] = rpc.mock.calls[1]
  expect(name).toBe('import_dictionary_copies_v1')
  for (const content of args.p_contents) {
    expect(parseDictionaryContent(content).success).toBe(true)
    expect(content).not.toHaveProperty('word_id')
    expect(content).not.toHaveProperty('interval_days')
  }
})
it.each([
  'unsupported-protocol',
  'network error',
  'invalid-import-reference',
  'target-collection-unavailable',
  'dictionary-import-cancelled',
])('does not downgrade an uncertain canonical import: %s', async message => {
  const error = { message }
  rpc.mockResolvedValue({ data: null, error })
  await expect(
    importStarterPackEntries(client, 'owned', manifest, entries)
  ).resolves.toMatchObject({ error })
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('never falls back from an unavailable hosted pack to a client copy', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: 'official-pack-unavailable' },
  })
  await importStarterPackEntries(
    client,
    'owned',
    { ...manifest, packId: 'hosted-pack' },
    entries
  )
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('keeps the existing legacy import when the feature is off', async () => {
  delete process.env.DICTIONARY_CONTENT_ENABLED
  await importStarterPackEntries(client, 'owned', manifest, entries)
  expect(rpc.mock.calls[0][0]).toBe('import_words_to_collection')
})
