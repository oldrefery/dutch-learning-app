import bundled from '@woordenaar/content'
import { validateOfficialContentManifest } from '@woordenaar/content/manifest'
import { officialEntryToDictionaryContent } from '@woordenaar/content/dictionary'
import { parseDictionaryCollectionExport } from '@woordenaar/domain'

export const OWNER = '10000000-0000-4000-8000-000000000001'
export const OTHER_OWNER = '10000000-0000-4000-8000-000000000002'
export const TARGET = '20000000-0000-4000-8000-000000000001'
export const WORD = '30000000-0000-4000-8000-000000000001'
const manifest = validateOfficialContentManifest(bundled)
if (!manifest.success) throw new Error('Invalid transfer test fixture')
export const content = officialEntryToDictionaryContent(
  manifest.data.entries[0]
)
export const document = parseDictionaryCollectionExport({
  schema_version: 1,
  collection: { name: 'Private source' },
  entries: [{ content }],
})
export const importCommand = {
  kind: 'import' as const,
  ownerId: OWNER,
  collectionId: TARGET,
  document,
  selectedIndexes: [0],
}
export const savedReply = {
  status: 'saved' as const,
  ownerId: OWNER,
  collectionId: TARGET,
  collectionName: 'Existing readonly collection',
  savedCount: 1,
  skippedCount: 0,
  cacheRefreshed: true,
}
