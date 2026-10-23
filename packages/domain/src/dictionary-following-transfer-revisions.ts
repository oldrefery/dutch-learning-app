import type { DictionaryAnalysisClientOwner } from './dictionary-analysis-client'
import { requireFollowingImportOwner } from './dictionary-following-import-journal'
import { FOLLOWING_TRANSFER_SELECTION_LIMIT } from './dictionary-following-transfer-journal'
import {
  parseDictionaryRevision,
  type DictionaryRevision,
} from './shared-dictionary'

export const DICTIONARY_TRANSFER_REVISION_COLUMNS =
  'revision_id,entry_id,revision_no,schema_version,content,content_sha256,cefr_input_sha256,review_status'

/** The adapter must query the authenticated public table with RLS and published
 * filtering. Missing rows are review cases; failed or malformed reads are errors. */
export async function readFollowingTransferRevisions(
  ids: readonly string[],
  owner: DictionaryAnalysisClientOwner,
  query: (ids: string[]) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<DictionaryRevision[]> {
  const unique = [...new Set(ids.map(requireFollowingImportOwner))]
  if (unique.length > FOLLOWING_TRANSFER_SELECTION_LIMIT)
    throw new Error('Too many transfer dependencies')
  owner.assert()
  if (!unique.length) return []
  await owner.check()
  const { data, error } = await query(unique)
  await owner.check()
  if (error)
    throw new Error('Published dictionary dependencies could not be loaded')
  if (!Array.isArray(data) || data.length > unique.length)
    throw new Error('Invalid published dictionary dependencies')
  const revisions = data.map(value => {
    const parsed = parseDictionaryRevision(value)
    if (
      !parsed.success ||
      parsed.data.review_status !== 'published' ||
      !unique.includes(parsed.data.revision_id)
    )
      throw new Error('Invalid published dictionary dependencies')
    return parsed.data
  })
  if (new Set(revisions.map(row => row.revision_id)).size !== revisions.length)
    throw new Error('Invalid published dictionary dependencies')
  return revisions
}
