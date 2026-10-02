/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@woordenaar/supabase-contracts'
import {
  parseDictionaryCollectionExport,
  parseSharedDictionaryCollection,
} from '@woordenaar/domain'
import { officialEntryToDictionaryContent } from '@woordenaar/content/dictionary'
import { loadOfficialStarterPack } from '@/features/starter-pack/starter-pack-domain'
import bundled from '@woordenaar/content'
import { validateOfficialContentManifest } from '@woordenaar/content/manifest'
import {
  exportOwnedDictionaryCollection,
  importDictionaryCollectionExport,
} from './dictionary-transfer'

jest.mock('server-only', () => ({}))
const rpc = jest.fn()
const client = { rpc } as unknown as SupabaseClient<Database>
const validated = validateOfficialContentManifest(bundled)
if (!validated.success) throw new Error('Invalid fixture')
const content = officialEntryToDictionaryContent(validated.data.entries[0])
const document = {
  schema_version: 1,
  collection: { name: loadOfficialStarterPack().title },
  entries: [{ content }],
}
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})

it('exports and reimports complete content without source IDs or learning state', async () => {
  rpc
    .mockResolvedValueOnce({ data: document, error: null })
    .mockResolvedValueOnce({ data: [], error: null })
  const result = await exportOwnedDictionaryCollection(client, 'owned')
  await importDictionaryCollectionExport(client, 'new-owned', result)
  expect(rpc).toHaveBeenNthCalledWith(1, 'export_dictionary_collection_v1', {
    p_collection_id: 'owned',
  })
  expect(rpc).toHaveBeenNthCalledWith(2, 'import_dictionary_copies_v1', {
    p_collection_id: 'new-owned',
    p_contents: [content],
  })
})
it.each([
  { ...document, schema_version: 2 },
  { ...document, user_id: 'another-owner' },
  { ...document, collection: { name: 'Source', collection_id: 'foreign' } },
  { ...document, entries: [{ content, reference: { entry_id: 'private' } }] },
  { ...document, entries: [{ content: { ...content, interval_days: 34 } }] },
  {
    ...document,
    entries: [{ content: { ...content, translations: undefined } }],
  },
])('rejects malformed or dependent exports before writing', async value => {
  expect(() => parseDictionaryCollectionExport(value)).toThrow(
    'Invalid dictionary collection transfer'
  )
  await expect(
    importDictionaryCollectionExport(client, 'owned', value)
  ).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects sharing projections with private metadata or duplicate source IDs', () => {
  const word = {
    word_id: '10000000-0000-4000-8000-000000000001',
    created_at: '2026-10-02T06:00:00Z',
    content,
  }
  const shared = {
    schema_version: 1,
    collection: {
      collection_id: '20000000-0000-4000-8000-000000000001',
      name: 'Shared',
    },
    words: [word],
  }
  expect(parseSharedDictionaryCollection(shared).words).toHaveLength(1)
  expect(() =>
    parseSharedDictionaryCollection({ ...shared, words: [word, word] })
  ).toThrow()
  expect(() =>
    parseSharedDictionaryCollection({
      ...shared,
      words: [{ ...word, private_revision: 'secret' }],
    })
  ).toThrow()
})
it('fails closed on export errors and when the dormant feature is disabled', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } })
  await expect(
    exportOwnedDictionaryCollection(client, 'owned')
  ).rejects.toThrow('Could not export')
  delete process.env.DICTIONARY_CONTENT_ENABLED
  await expect(
    importDictionaryCollectionExport(client, 'owned', document)
  ).rejects.toThrow('unavailable')
  expect(rpc).toHaveBeenCalledTimes(1)
})
