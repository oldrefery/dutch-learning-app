import type { DictionaryAnalysisClientOwner } from './dictionary-analysis-client'
import { parseDictionaryFollowingCapability } from './dictionary-following'
import type { DictionaryCollectionExportV2 } from './dictionary-following-import'
import { readFollowingTransferRevisions } from './dictionary-following-transfer-revisions'
import { FOLLOWING_TRANSFER_SELECTION_LIMIT } from './dictionary-following-transfer-journal'
import {
  parseDictionaryEntry,
  parseDictionaryReference,
  type DictionaryEntry,
} from './shared-dictionary'

export const DICTIONARY_MEANING_ENTRY_COLUMNS =
  'entry_id,language_code,lemma,part_of_speech,article,sense_key,state'
export const DICTIONARY_MEANING_HEAD_COLUMNS = 'entry_id,revision_id'
export const DICTIONARY_MEANING_LOOKUP_LIMIT =
  FOLLOWING_TRANSFER_SELECTION_LIMIT
const INVALID_LOOKUP = 'Published meanings could not be verified. Please retry.'

export const normalizeDictionaryMeaningQuery = (input: string): string => {
  const query = input.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
  if (
    !query ||
    query.length > 120 ||
    [...query].some(
      char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
    )
  )
    throw new Error('Enter a Dutch word or expression of up to 120 characters.')
  return query
}

type QueryResult = PromiseLike<{ data: unknown; error: unknown }>
export interface DictionaryMeaningLookupPorts {
  owner: DictionaryAnalysisClientOwner
  enabled: () => boolean
  capability: () => QueryResult
  entries: (query: string) => QueryResult
  heads: (entryIds: string[]) => QueryResult
  revisions: (revisionIds: string[]) => QueryResult
}

const parseEntries = (value: unknown, query: string): DictionaryEntry[] => {
  if (!Array.isArray(value)) throw new Error(INVALID_LOOKUP)
  if (value.length > DICTIONARY_MEANING_LOOKUP_LIMIT)
    throw new Error(
      'Too many published meanings. Refine the word or expression.'
    )
  const rows = value.map(row => {
    const parsed = parseDictionaryEntry(row)
    if (
      !parsed.success ||
      parsed.data.language_code !== 'nl' ||
      parsed.data.lemma !== query ||
      parsed.data.state !== 'published'
    )
      throw new Error(INVALID_LOOKUP)
    return parsed.data
  })
  if (new Set(rows.map(row => row.entry_id)).size !== rows.length)
    throw new Error(INVALID_LOOKUP)
  return rows
}

const parseHeads = (value: unknown, entryIds: string[]) => {
  if (!Array.isArray(value) || value.length !== entryIds.length)
    throw new Error(INVALID_LOOKUP)
  const rows = value.map(row => {
    const parsed = parseDictionaryReference(row)
    if (!parsed.success || !entryIds.includes(parsed.data.entry_id))
      throw new Error(INVALID_LOOKUP)
    return parsed.data
  })
  if (
    new Set(rows.map(row => row.entry_id)).size !== rows.length ||
    new Set(rows.map(row => row.revision_id)).size !== rows.length
  )
    throw new Error(INVALID_LOOKUP)
  return rows
}

/** Exact lemma finds candidates, never meaning identity. Each published head is
 * retained in full; the caller must explicitly select meanings before adoption.
 * No provider, private word, collection write or operation is created here. */
export async function findPublishedDictionaryMeanings(
  input: string,
  ports: DictionaryMeaningLookupPorts
): Promise<DictionaryCollectionExportV2> {
  const query = normalizeDictionaryMeaningQuery(input)
  const assert = () => {
    ports.owner.assert()
    if (!ports.enabled())
      throw new Error('Published meaning lookup is unavailable')
  }
  const checkedOwner: DictionaryAnalysisClientOwner = {
    assert,
    check: async () => {
      assert()
      await ports.owner.check()
      assert()
    },
  }
  const read = async (request: () => QueryResult) => {
    await checkedOwner.check()
    const result = await request()
    await checkedOwner.check()
    if (result.error) throw result.error
    return result.data
  }
  const capability = parseDictionaryFollowingCapability(
    await read(ports.capability)
  )
  if (
    !capability.success ||
    !capability.data.following_enabled ||
    !capability.data.read_protocol_versions.includes(2) ||
    !capability.data.command_protocol_versions.includes(2)
  )
    throw new Error('Published meaning lookup is unavailable')
  const entries = parseEntries(await read(() => ports.entries(query)), query)
  const document: DictionaryCollectionExportV2 = {
    schema_version: 2,
    collection: { name: `Published meanings for ${query}` },
    entries: [],
  }
  if (!entries.length) return document
  const heads = parseHeads(
    await read(() => ports.heads(entries.map(row => row.entry_id))),
    entries.map(row => row.entry_id)
  )
  const revisions = await readFollowingTransferRevisions(
    heads.map(row => row.revision_id),
    checkedOwner,
    ports.revisions
  )
  document.entries = entries.map(entry => {
    const head = heads.find(row => row.entry_id === entry.entry_id)
    const revision = revisions.find(
      row => row.revision_id === head?.revision_id
    )
    if (
      !revision ||
      revision.entry_id !== entry.entry_id ||
      revision.content.dutch_lemma !== entry.lemma ||
      revision.content.part_of_speech !== entry.part_of_speech ||
      revision.content.article !== entry.article
    )
      throw new Error(INVALID_LOOKUP)
    return {
      content: revision.content,
      shared_reference: {
        reference: {
          entry_id: entry.entry_id,
          revision_id: revision.revision_id,
        },
        content_sha256: revision.content_sha256,
      },
    }
  })
  assert()
  return document
}
