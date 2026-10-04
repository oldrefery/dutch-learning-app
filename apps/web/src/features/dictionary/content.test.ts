import { applyEffectiveCards, parseEffectiveCards } from './content'
import { buildWordDetail } from '@/features/words/word-detail'
import { createWordRow, effectiveCard } from './__fixtures__/cards'

const envelope = (cards: unknown[]) => ({ protocol_version: 1, cards })

it('applies pinned content while preserving personal identity, collection and learning state', () => {
  const row = createWordRow({
    repetition_count: 14,
    interval_days: 38,
    easiness_factor: 2.1,
  })
  const [materialized] = applyEffectiveCards(
    [row],
    parseEffectiveCards(envelope([effectiveCard()]))
  )
  expect(materialized).toMatchObject({
    word_id: row.word_id,
    user_id: row.user_id,
    collection_id: row.collection_id,
    repetition_count: 14,
    interval_days: 38,
    easiness_factor: 2.1,
    translations: { en: ['dwelling'], ru: [] },
    dictionary: {
      contentVersion: 3,
      cefr: { level: 'A1', status: 'reviewed' },
    },
  })
  expect(row.translations).toEqual({ en: ['house'], ru: ['дом'] })
})

it('preserves explicit removals and tolerates legacy private JSON without inheriting old values', () => {
  const card = effectiveCard()
  const content = {
    ...card.content,
    translations: null,
    examples: null,
    synonyms: null,
    plural: null,
    analysis_notes: '',
  }
  const [row] = applyEffectiveCards(
    [createWordRow()],
    parseEffectiveCards(
      envelope([
        {
          ...card,
          reference: null,
          source: 'fallback',
          content,
          removed_fields: ['translations', 'examples', 'synonyms', 'plural'],
          cefr: { level: null, status: 'unknown', confidence: null },
        },
      ])
    )
  )
  expect(buildWordDetail(row)).toMatchObject({
    translations: { en: [], ru: [] },
    examples: [],
    synonyms: [],
    plural: null,
  })
})

it.each([
  { content_version: -1 },
  { reference: { entry_id: 'bad', revision_id: 'bad' } },
  { cefr: { level: 'B3', status: 'reviewed', confidence: 0.9 } },
  { cefr: { level: 'B1', status: 'unknown', confidence: null } },
  { removed_fields: ['user_id'] },
  { removed_fields: ['dutch_lemma'] },
  { content: { ...effectiveCard().content, repetition_count: 999 } },
  { content: { ...effectiveCard().content, synonyms: [42] } },
])('rejects malformed or personal-state-bearing content: %j', patch => {
  expect(() =>
    parseEffectiveCards(envelope([{ ...effectiveCard(), ...patch }]))
  ).toThrow('dictionary content')
})

it('rejects missing, duplicate and unexpected card identities', () => {
  expect(() =>
    parseEffectiveCards(envelope([effectiveCard(), effectiveCard()]))
  ).toThrow()
  expect(() =>
    applyEffectiveCards([createWordRow()], parseEffectiveCards(envelope([])))
  ).toThrow()
  expect(() =>
    applyEffectiveCards(
      [createWordRow()],
      parseEffectiveCards(envelope([effectiveCard('foreign')]))
    )
  ).toThrow()
})
