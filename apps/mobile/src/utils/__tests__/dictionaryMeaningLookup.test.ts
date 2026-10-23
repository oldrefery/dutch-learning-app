import {
  findPublishedDictionaryMeanings,
  normalizeDictionaryMeaningQuery,
  planDictionaryFollowingTransfer,
  parseFollowingTransferSession,
  type DictionaryMeaningLookupPorts,
} from '@woordenaar/domain'
import {
  transferRevision,
  transferSession,
} from '@/db/__tests__/dictionaryFollowingTransfer.fixture'

const OTHER_ENTRY = '71717171-7171-4171-8171-717171717171'
const OTHER_REVISION = '72727272-7272-4272-8272-727272727272'
const INVALID = 'could not be verified'
const entry = () => ({
  entry_id: transferRevision.entry_id,
  language_code: 'nl',
  lemma: transferRevision.content.dutch_lemma,
  part_of_speech: transferRevision.content.part_of_speech,
  article: transferRevision.content.article,
  sense_key: 'sense-1',
  state: 'published',
})
const capability = () => ({
  dictionary_content_protocol: 2,
  read_protocol_versions: [1, 2],
  command_protocol_versions: [2],
  following_enabled: true,
  shared_analysis_enabled: false,
})
const success = (data: unknown) => ({ data, error: null })
const ports = () => ({
  owner: { assert: jest.fn(), check: jest.fn().mockResolvedValue(undefined) },
  enabled: jest.fn(() => true),
  capability: jest.fn().mockResolvedValue(success(capability())),
  entries: jest.fn().mockResolvedValue(success([entry()])),
  heads: jest.fn().mockResolvedValue(
    success([
      {
        entry_id: transferRevision.entry_id,
        revision_id: transferRevision.revision_id,
      },
    ])
  ),
  revisions: jest.fn().mockResolvedValue(success([transferRevision])),
})
let api: ReturnType<typeof ports>
beforeEach(() => {
  api = ports()
})
const lookup = () => findPublishedDictionaryMeanings(' HUIS ', api)

it('retains every distinct published meaning with exact full content and only selected identities in a durable draft', async () => {
  const other = {
    ...transferRevision,
    entry_id: OTHER_ENTRY,
    revision_id: OTHER_REVISION,
    content: {
      ...transferRevision.content,
      translations: { en: ['household'], ru: [] },
    },
  }
  api.entries.mockResolvedValue(
    success([
      entry(),
      { ...entry(), entry_id: OTHER_ENTRY, sense_key: 'sense-2' },
    ])
  )
  api.heads.mockResolvedValue(
    success([
      { entry_id: OTHER_ENTRY, revision_id: OTHER_REVISION },
      {
        entry_id: transferRevision.entry_id,
        revision_id: transferRevision.revision_id,
      },
    ])
  )
  api.revisions.mockResolvedValue(success([other, transferRevision]))
  const document = await lookup()
  expect(api.entries).toHaveBeenCalledWith('huis')
  expect(document.entries.map(row => row.content)).toEqual([
    transferRevision.content,
    other.content,
  ])
  expect(
    document.entries.map(row => row.shared_reference?.reference.entry_id)
  ).toEqual([transferRevision.entry_id, OTHER_ENTRY])
  const saved = transferSession()
  saved.document = document
  saved.selected_indexes = [1]
  let nonce = 0
  const { intents, review } = planDictionaryFollowingTransfer({
    document,
    collectionId: saved.collection_id,
    selectedIndexes: [1],
    revisions: [transferRevision, other],
    createId: () => [OTHER_ENTRY, OTHER_REVISION][nonce++],
  })
  saved.plan = { intents, review, revisions: [other] }
  const restarted = parseFollowingTransferSession(
    JSON.parse(JSON.stringify(saved))
  )
  expect(restarted.selected_indexes).toEqual([1])
  expect(restarted.plan?.intents).toHaveLength(1)
  expect(restarted.plan?.intents[0]?.intent.source).toMatchObject({
    kind: 'published-reference',
    reference: { entry_id: OTHER_ENTRY, revision_id: OTHER_REVISION },
  })
})

it('returns a retained empty result without reading heads or calling a provider for an unresolved spelling', async () => {
  api.entries.mockResolvedValue(success([]))
  expect((await lookup()).entries).toEqual([])
  expect(api.heads).not.toHaveBeenCalled()
  expect(api.revisions).not.toHaveBeenCalled()
})

it.each([
  { ...entry(), state: 'draft' },
  { ...entry(), state: 'retired' },
  { ...entry(), lemma: 'anders' },
  { ...entry(), language_code: 'en' },
  { ...entry(), user_id: OTHER_ENTRY },
  { ...entry(), sense_key: '' },
])('rejects unpublished, unrelated or private entry data', async row => {
  api.entries.mockResolvedValue(success([row]))
  await expect(lookup()).rejects.toThrow(INVALID)
  expect(api.heads).not.toHaveBeenCalled()
})

it('rejects duplicate candidates and over-limit responses instead of silently losing meanings', async () => {
  api.entries.mockResolvedValue(success([entry(), entry()]))
  await expect(lookup()).rejects.toThrow(INVALID)
  api.entries.mockResolvedValue(success(Array.from({ length: 101 }, entry)))
  await expect(lookup()).rejects.toThrow('Too many')
})

it.each(
  [
    [],
    [{ entry_id: OTHER_ENTRY, revision_id: transferRevision.revision_id }],
    [{ entry_id: transferRevision.entry_id, revision_id: 'invalid' }],
    [
      {
        entry_id: transferRevision.entry_id,
        revision_id: transferRevision.revision_id,
        user_id: OTHER_ENTRY,
      },
    ],
  ].map(data => ({ data }))
)('rejects missing or mismatched heads', async ({ data }) => {
  api.heads.mockResolvedValue(success(data))
  await expect(lookup()).rejects.toThrow()
  expect(api.revisions).not.toHaveBeenCalled()
})

it.each(
  [
    [],
    [{ ...transferRevision, entry_id: OTHER_ENTRY }],
    [{ ...transferRevision, review_status: 'draft' }],
    [
      {
        ...transferRevision,
        content: { ...transferRevision.content, dutch_lemma: 'anders' },
      },
    ],
    [
      {
        ...transferRevision,
        content: { ...transferRevision.content, article: 'de' },
      },
    ],
  ].map(data => ({ data }))
)(
  'rejects missing, unpublished or different-identity revisions',
  async ({ data }) => {
    api.revisions.mockResolvedValue(success(data))
    await expect(lookup()).rejects.toThrow()
  }
)

it.each(['capability', 'entries', 'heads', 'revisions'] as const)(
  'retains %s read failure and never falls back',
  async name => {
    api[name].mockResolvedValue({ data: null, error: new Error('Offline') })
    await expect(lookup()).rejects.toThrow(
      name === 'revisions' ? 'dependencies could not be loaded' : 'Offline'
    )
  }
)

it.each([
  { ...capability(), following_enabled: false },
  { ...capability(), read_protocol_versions: [1] },
  { ...capability(), command_protocol_versions: [1] },
  { ...capability(), dictionary_content_protocol: 1 },
])(
  'requires v2 reads and adoption before looking up candidates',
  async data => {
    api.capability.mockResolvedValue(success(data))
    await expect(lookup()).rejects.toThrow('unavailable')
    expect(api.entries).not.toHaveBeenCalled()
  }
)

it('fences a disabled gate before reads and a withdrawn gate before further dependencies', async () => {
  api.enabled.mockReturnValue(false)
  await expect(lookup()).rejects.toThrow('unavailable')
  expect(api.capability).not.toHaveBeenCalled()
  api.enabled.mockReturnValue(true)
  api.entries.mockImplementation(async () => {
    api.enabled.mockReturnValue(false)
    return success([entry()])
  })
  await expect(lookup()).rejects.toThrow('unavailable')
  expect(api.heads).not.toHaveBeenCalled()
})

it('rejects an owner change after a read before parsing or returning results', async () => {
  api.revisions.mockImplementation(async () => {
    api.owner.check.mockRejectedValue(new Error('Authentication changed'))
    return success([transferRevision])
  })
  await expect(lookup()).rejects.toThrow('Authentication changed')
})

it('rejects stale input or unmounted views before the next request', async () => {
  api.entries.mockImplementation(async () => {
    api.owner.assert.mockImplementation(() => {
      throw new Error('Word input changed')
    })
    return success([entry()])
  })
  await expect(lookup()).rejects.toThrow('Word input changed')
  expect(api.heads).not.toHaveBeenCalled()
})

it('normalizes exact Dutch input without interpreting wildcard or expression characters', () => {
  expect(normalizeDictionaryMeaningQuery('  IN   DE % _ Wolken ')).toBe(
    'in de % _ wolken'
  )
  expect(normalizeDictionaryMeaningQuery('e\u0301e\u0301n')).toBe('één')
})
it.each(['', ' '.repeat(3), 'a'.repeat(121), '\u0000huis'])(
  'rejects invalid input before any request',
  async input => {
    await expect(
      findPublishedDictionaryMeanings(
        input,
        api as DictionaryMeaningLookupPorts
      )
    ).rejects.toThrow('Enter a Dutch')
    expect(api.capability).not.toHaveBeenCalled()
  }
)
