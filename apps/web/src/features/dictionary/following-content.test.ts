import {
  parseFollowingCards,
  validateFollowingHeads,
} from './following-content'
import { applyEffectiveCards } from './content'
import { followingBatch, publishedRevision } from './__fixtures__/following'
import { createWordRow, effectiveCard } from './__fixtures__/cards'

it('hydrates two personal references from one head without overlays or learning replacement', () => {
  const rows = [
    createWordRow({ repetition_count: 17 }),
    createWordRow({
      word_id: '44444444-4444-4444-8444-444444444444',
      user_id: 'second-owner',
      repetition_count: 23,
    }),
  ]
  const { cards, watermark } = parseFollowingCards(
    followingBatch(rows.map(row => row.word_id))
  )
  const result = applyEffectiveCards(rows, cards)
  expect(result.map(row => row.translations)).toEqual([
    { en: ['dwelling'], ru: [] },
    { en: ['dwelling'], ru: [] },
  ])
  expect(
    result.map(row => [row.word_id, row.user_id, row.repetition_count])
  ).toEqual(rows.map(row => [row.word_id, row.user_id, row.repetition_count]))
  expect(result[0].dictionary).toMatchObject({
    mode: 'follow',
    source: 'following',
    contentVersion: '9007199254740993',
    headSequence: '9007199254740994',
    watermark,
    adoptedRevisionId: '33333333-3333-4333-8333-333333333333',
  })
  expect(rows[0].translations).toEqual({ en: ['house'], ru: ['дом'] })
})

it.each([
  { revisions: [] },
  { revisions: [{ ...publishedRevision(), review_status: 'draft' }] },
  {
    revisions: [
      {
        ...publishedRevision(),
        entry_id: '55555555-5555-4555-8555-555555555555',
      },
    ],
  },
  { watermark: '9007199254740993' },
])(
  'rejects incomplete, mismatched, unpublished or future dependencies: %p',
  delta => {
    expect(() =>
      parseFollowingCards({ ...followingBatch(), ...delta })
    ).toThrow('dictionary content')
  }
)

it('preserves legacy effective content without replacing it with the shared dependency', () => {
  const batch = followingBatch()
  const legacy = effectiveCard()
  const { cards } = parseFollowingCards({
    ...batch,
    cards: [
      {
        ...batch.cards[0],
        mode: 'legacy',
        head_sequence: null,
        adopted_revision_id: legacy.reference.revision_id,
        legacy_content: {
          ...publishedRevision().content,
          translations: { en: ['private dwelling'], ru: [] },
        },
      },
    ],
  })
  expect(cards.get(createWordRow().word_id)).toMatchObject({
    mode: 'legacy',
    source: 'pinned',
    headSequence: null,
    content: { translations: { en: ['private dwelling'], ru: [] } },
  })
})

it('accepts rollback to an older revision with a newer delivery sequence', () => {
  const batch = followingBatch()
  const revision = {
    ...publishedRevision(),
    revision_no: 1,
    revision_id: batch.cards[0].adopted_revision_id,
  }
  const { cards } = parseFollowingCards({
    ...batch,
    watermark: '9007199254740995',
    cards: [
      {
        ...batch.cards[0],
        head_sequence: '9007199254740995',
        reference: {
          entry_id: revision.entry_id,
          revision_id: revision.revision_id,
        },
      },
    ],
    revisions: [revision],
  })
  expect(() => validateFollowingHeads(cards)).not.toThrow()
  expect(cards.get(createWordRow().word_id)?.reference?.revision_id).toBe(
    revision.revision_id
  )
})

it('rejects inconsistent heads for the same entry before displaying a mixed page', () => {
  const { cards } = parseFollowingCards(followingBatch())
  const original = cards.get(createWordRow().word_id)!
  const otherId = '44444444-4444-4444-8444-444444444444'
  cards.set(otherId, {
    ...original,
    wordId: otherId,
    protocolVersion: 2,
    mode: 'follow',
    contentVersion: '1',
    headSequence: '9007199254740995',
    watermark: '9007199254740995',
    adoptedRevisionId: publishedRevision().revision_id,
  })
  expect(() => validateFollowingHeads(cards)).toThrow('changed during loading')
})

it('supports a maximum-sized 10000-card snapshot using one shared dependency', () => {
  const ids = Array.from(
    { length: 10000 },
    (_, index) =>
      `44444444-4444-4444-8444-${index.toString(16).padStart(12, '0')}`
  )
  const { cards } = parseFollowingCards(followingBatch(ids))
  expect(cards.size).toBe(10000)
  expect(cards.get(ids[9999])?.content.translations).toEqual({
    en: ['dwelling'],
    ru: [],
  })
  expect(() => validateFollowingHeads(cards)).not.toThrow()
  expect(() =>
    parseFollowingCards(
      followingBatch([...ids, '55555555-5555-4555-8555-555555555555'])
    )
  ).toThrow('dictionary content')
})

it('keeps revision projections scoped to a batch and independently replaceable per personal card', () => {
  const ids = [createWordRow().word_id, '44444444-4444-4444-8444-444444444444']
  const first = parseFollowingCards(followingBatch(ids))
  first.cards.get(ids[0])!.content.translations = { en: ['local replacement'] }
  expect(first.cards.get(ids[1])!.content.translations).toEqual({
    en: ['dwelling'],
    ru: [],
  })
  const next = followingBatch(ids)
  next.revisions[0].content.translations = {
    en: ['new request content'],
    ru: [],
  }
  expect(
    parseFollowingCards(next).cards.get(ids[0])!.content.translations
  ).toEqual({ en: ['new request content'], ru: [] })
  expect(first.cards.get(ids[1])!.content.translations).toEqual({
    en: ['dwelling'],
    ru: [],
  })
})

it('keeps legacy explicit removals and private JSON readable through the new protocol', () => {
  const batch = followingBatch()
  const legacyContent = {
    ...publishedRevision().content,
    translations: null,
    examples: null,
    synonyms: null,
    plural: null,
    is_irregular: null,
    usage_notes: { old_format: 'Protected private note' },
    analysis_notes: '',
  }
  const { cards } = parseFollowingCards({
    ...batch,
    revisions: [],
    cards: [
      {
        ...batch.cards[0],
        mode: 'legacy',
        reference: null,
        adopted_revision_id: null,
        head_sequence: null,
        legacy_content: legacyContent,
        removed_fields: [
          'translations',
          'examples',
          'synonyms',
          'plural',
          'is_irregular',
        ],
      },
    ],
  })
  const [word] = applyEffectiveCards([createWordRow()], cards)
  expect(word).toMatchObject({
    translations: { en: [], ru: [] },
    examples: [],
    synonyms: [],
    plural: null,
    is_irregular: null,
    analysis_notes: '',
    usage_notes: { old_format: 'Protected private note' },
    dictionary: { mode: 'legacy', source: 'fallback' },
  })
  expect(() =>
    parseFollowingCards({
      ...batch,
      revisions: [{ ...publishedRevision(), content: legacyContent }],
    })
  ).toThrow('dictionary content')
})
