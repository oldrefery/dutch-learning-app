import { planDictionaryFollowingTransfer } from '@woordenaar/domain'
import {
  followingBatch,
  followingContent,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import {
  COLLECTION_ID,
  IMPORT_ID,
  RECOVERY_ID,
} from '@/db/__tests__/dictionaryFollowingImport.fixture'
import {
  parseDictionaryTransferText,
  serializeDictionaryTransfer,
  previewDictionaryTransfer,
  importOfflineDictionaryCollection,
} from '@/services/dictionaryTransferService'
import { useApplicationStore } from '@/stores/useApplicationStore'

jest.mock('@/db/initDB')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))
const revision = followingBatch().revisions[0]
const document = () => ({
  schema_version: 2,
  collection: { name: 'Portable source' },
  entries: [
    {
      content: revision.content,
      shared_reference: {
        reference: {
          entry_id: revision.entry_id,
          revision_id: revision.revision_id,
        },
        content_sha256: revision.content_sha256,
      },
    },
    { content: followingContent, shared_reference: null },
  ],
})
const plan = (value = document(), revisions = [revision]) =>
  planDictionaryFollowingTransfer({
    document: value,
    collectionId: COLLECTION_ID,
    selectedIndexes: [0, 1],
    revisions,
    createId: jest
      .fn()
      .mockReturnValueOnce(IMPORT_ID)
      .mockReturnValueOnce(RECOVERY_ID),
  })

describe('transfer2 preserves snapshots and requires exact published references', () => {
  it('proposes only exact verified content and returns the entire original for unresolved review', () => {
    const result = plan()
    expect(result.document).toEqual(document())
    expect(result.intents).toHaveLength(1)
    expect(result.intents[0].intent.source).toMatchObject({
      kind: 'published-reference',
    })
    expect(result.intents[0].intent).not.toHaveProperty('content')
    expect(result.review).toEqual([
      { index: 1, reason: 'unresolved-reference' },
    ])
  })
  it('keeps changed private examples/media for review rather than adopting a hinted reference', () => {
    const value = document()
    value.entries[0].content = {
      ...revision.content,
      examples: [
        { nl: 'Private sentence.', en: 'Private translation.', ru: null },
      ],
      image_url: 'https://example.com/private-image.png',
    }
    expect(plan(value).review).toEqual([
      { index: 0, reason: 'content-difference' },
      { index: 1, reason: 'unresolved-reference' },
    ])
    expect(plan(value).document.entries[0].content).toEqual(
      value.entries[0].content
    )
  })
  it('rejects hash/identity hints and never resolves by matching spelling', () => {
    const value = document()
    const hint = value.entries[0].shared_reference
    if (!hint) throw new Error('Missing fixture hint')
    hint.content_sha256 = 'f'.repeat(64)
    expect(plan(value).intents).toEqual([])
    expect(plan(document(), []).intents).toEqual([])
  })
  it('compares objects canonically and allocates IDs only for resolved entries', () => {
    const value = document()
    value.entries[0].content = {
      ...revision.content,
      translations: { ru: ['дом'], en: ['house'] },
    }
    expect(plan(value).intents).toHaveLength(1)
  })
  it('validates selected indexes and refuses duplicate dependencies', () => {
    expect(() =>
      planDictionaryFollowingTransfer({
        document: document(),
        collectionId: COLLECTION_ID,
        selectedIndexes: [0, 0],
        revisions: [revision],
        createId: () => IMPORT_ID,
      })
    ).toThrow('valid')
    expect(() => plan(document(), [revision, revision])).toThrow('dependencies')
  })
  it('previews and round-trips transfer2 without exposing reference IDs as personal IDs', () => {
    const text = serializeDictionaryTransfer(document())
    expect(parseDictionaryTransferText(text)).toEqual(document())
    expect(
      previewDictionaryTransfer(text).words.map(row => row.word_id)
    ).toEqual(['0', '1'])
  })
  it('refuses to send transfer2 through private-copy import', async () => {
    jest.mocked(useApplicationStore.getState).mockReturnValue({
      currentUserId: '11111111-1111-4111-8111-111111111111',
    } as never)
    await expect(
      importOfflineDictionaryCollection(
        JSON.stringify(document()),
        COLLECTION_ID,
        ['0'],
        '11111111-1111-4111-8111-111111111111'
      )
    ).rejects.toThrow('shared-reference import review')
  })
  it('continues to parse legacy schema1 documents without adding shared-reference hints', () => {
    const legacy = {
      schema_version: 1,
      collection: { name: 'Legacy' },
      entries: [{ content: followingContent }],
    }
    expect(
      parseDictionaryTransferText(serializeDictionaryTransfer(legacy))
    ).toEqual(legacy)
  })
})
