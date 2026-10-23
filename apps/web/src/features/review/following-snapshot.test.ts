/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { createClient } from '@/lib/supabase/server'
import { getReviewWorkspaceData, mapReviewSnapshot } from './repository'
import { followingSnapshot } from '@/features/dictionary/__fixtures__/following'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const rpc = jest.fn()
const from = jest.fn()
const priorContent = process.env.DICTIONARY_CONTENT_ENABLED
const priorFollowing = process.env.DICTIONARY_FOLLOWING_ENABLED
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  process.env.DICTIONARY_FOLLOWING_ENABLED = 'true'
  jest
    .mocked(createClient)
    .mockResolvedValue({ rpc, from } as unknown as Awaited<
      ReturnType<typeof createClient>
    >)
})
afterAll(() => {
  for (const [name, value] of [
    ['DICTIONARY_CONTENT_ENABLED', priorContent],
    ['DICTIONARY_FOLLOWING_ENABLED', priorFollowing],
  ]) {
    if (value === undefined) delete process.env[name!]
    else process.env[name!] = value
  }
})

it('reads following content, dependencies and learning in one v3 database snapshot', async () => {
  rpc.mockResolvedValue({ data: followingSnapshot(), error: null })
  const result = await getReviewWorkspaceData('synthetic-owner')
  expect(result).toMatchObject({
    dictionaryContentEnabled: true,
    dictionaryWatermark: '9007199254740994',
    words: [
      {
        repetitionCount: 12,
        translations: { en: ['dwelling'], ru: [] },
        dictionary: {
          mode: 'follow',
          headSequence: '9007199254740994',
          contentVersion: '9007199254740993',
        },
      },
    ],
  })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('get_web_review_snapshot_v3')
  expect(from).not.toHaveBeenCalled()
})

it.each(['PGRST202', '42501', 'NETWORK'])(
  'does not downgrade an enabled v3 snapshot on %s',
  async code => {
    rpc.mockResolvedValue({ data: null, error: { code } })
    await expect(getReviewWorkspaceData('synthetic-owner')).rejects.toThrow(
      'review workspace'
    )
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalled()
  }
)

it.each([2, '3', 4])(
  'rejects a substituted snapshot protocol: %p',
  async protocolVersion => {
    rpc.mockResolvedValue({
      data: { ...followingSnapshot(), protocolVersion },
      error: null,
    })
    await expect(getReviewWorkspaceData('synthetic-owner')).rejects.toThrow(
      'review workspace'
    )
  }
)

it('rejects missing dependencies, missing cards and duplicated personal IDs', () => {
  const snapshot = followingSnapshot()
  expect(() =>
    mapReviewSnapshot({
      ...snapshot,
      dictionaryContent: { ...snapshot.dictionaryContent, revisions: [] },
    })
  ).toThrow('dictionary content')
  expect(() =>
    mapReviewSnapshot({
      ...snapshot,
      dictionaryContent: {
        ...snapshot.dictionaryContent,
        cards: [],
        revisions: [],
      },
    })
  ).toThrow('dictionary content')
  expect(() =>
    mapReviewSnapshot({
      ...snapshot,
      words: [snapshot.words[0], snapshot.words[0]],
    })
  ).toThrow('review workspace')
})

it('projects shared and private lexical content while retaining personal learning and placement', () => {
  const snapshot = followingSnapshot()
  const otherId = '44444444-4444-4444-8444-444444444444'
  const first = snapshot.dictionaryContent.cards[0]
  const reference = first.reference!
  const privateContent = {
    ...snapshot.dictionaryContent.revisions[0].content,
    dutch_lemma: 'private lemma',
    translations: { en: ['private translation'], ru: [] },
  }
  const original = snapshot.words[0]
  const other = {
    ...original,
    word_id: otherId,
    collection_id: null,
    repetition_count: 29,
    interval_days: 9,
    easiness_factor: 1.7,
    next_review_date: '2026-10-12',
  }
  const data = mapReviewSnapshot({
    ...snapshot,
    words: [original, other],
    dictionaryContent: {
      ...snapshot.dictionaryContent,
      cards: [
        first,
        {
          ...first,
          word_id: otherId,
          mode: 'legacy',
          adopted_revision_id: reference.revision_id,
          head_sequence: null,
          legacy_content: privateContent,
        },
      ],
    },
  })
  expect(data.words[0]).toMatchObject({
    id: original.word_id,
    repetitionCount: 12,
    translations: { en: ['dwelling'], ru: [] },
  })
  expect(data.words[1]).toMatchObject({
    id: otherId,
    collectionId: null,
    repetitionCount: 29,
    intervalDays: 9,
    easinessFactor: 1.7,
    nextReviewDate: '2026-10-12',
    dutchLemma: 'private lemma',
    translations: privateContent.translations,
    dictionary: { mode: 'legacy', reference, headSequence: null },
  })
  expect(data.events).toEqual(mapReviewSnapshot(snapshot).events)
  expect(snapshot.words).toEqual([original])
  expect(() =>
    mapReviewSnapshot({
      ...snapshot,
      words: [{ ...original, repetition_count: '12' }],
    })
  ).toThrow('review workspace')
  expect(() =>
    mapReviewSnapshot({
      ...snapshot,
      words: [{ ...original, word_id: otherId }],
    })
  ).toThrow('dictionary content')
})
