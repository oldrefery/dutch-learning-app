import {
  buildSharedCollectionImportPayload,
  buildSharedCollectionPreview,
  buildSharedCollectionUrl,
  isSharedResourceId,
  removeExistingSharedWords,
  selectSharedCollectionWords,
  type SharedCollectionWord,
} from './shared-collection-domain'

const createWord = (
  overrides: Partial<SharedCollectionWord> = {}
): SharedCollectionWord => ({
  analysis_notes: 'Common household noun.',
  antonyms: [],
  article: 'het',
  conjugation: null,
  created_at: '2026-08-01T12:00:00.000Z',
  dutch_lemma: 'huis',
  dutch_original: 'huis',
  examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.' }],
  expression_type: null,
  image_url: null,
  is_expression: false,
  is_irregular: false,
  is_reflexive: false,
  is_separable: false,
  part_of_speech: 'noun',
  plural: 'huizen',
  prefix_part: null,
  preposition: null,
  register: 'neutral',
  root_verb: null,
  synonyms: ['woning'],
  translations: { en: ['house', 'home'], ru: ['дом'] },
  tts_url: '',
  usage_notes: { summary: 'A place where someone lives.' },
  word_id: '0dc42f8e-d58a-4e86-b26e-94fb54ab501b',
  ...overrides,
})

describe('shared collection domain', () => {
  it('builds the canonical production link and validates resource IDs', () => {
    const token = '8c3616c6-d337-4e63-b0bf-a9dbb735a8b4'

    expect(buildSharedCollectionUrl(token)).toBe(
      `https://woordenaar.app/share/${token}`
    )
    expect(isSharedResourceId(token)).toBe(true)
    expect(isSharedResourceId('not-a-token')).toBe(false)
  })

  it('marks semantic duplicates independently of casing', () => {
    const preview = buildSharedCollectionPreview(
      [
        createWord(),
        createWord({
          article: null,
          dutch_lemma: 'opstaan',
          part_of_speech: 'verb',
          word_id: 'aa0a90c8-b5b7-4e89-8ddd-87e39ce38e22',
        }),
      ],
      [
        {
          dutchLemma: ' HUIS ',
          partOfSpeech: 'NOUN',
          article: 'HET',
          collectionName: 'My words',
        },
      ]
    )

    expect(preview[0]).toEqual(
      expect.objectContaining({
        isDuplicate: true,
        duplicateCollectionName: 'My words',
        translation: 'house',
      })
    )
    expect(preview[1]?.isDuplicate).toBe(false)
  })

  it('accepts only selected non-duplicate words and builds RPC-safe JSON', () => {
    const house = createWord()
    const verb = createWord({
      article: null,
      dutch_lemma: 'opstaan',
      is_separable: true,
      part_of_speech: 'verb',
      prefix_part: 'op',
      root_verb: 'staan',
      word_id: 'aa0a90c8-b5b7-4e89-8ddd-87e39ce38e22',
    })
    const selected = selectSharedCollectionWords(
      [house, verb],
      [verb.word_id, 'unknown-id', verb.word_id]
    )
    const importable = removeExistingSharedWords(selected, [
      {
        dutchLemma: 'huis',
        partOfSpeech: 'noun',
        article: 'het',
        collectionName: null,
      },
    ])

    expect(importable).toEqual([verb])
    expect(buildSharedCollectionImportPayload(importable)).toEqual([
      expect.objectContaining({
        dutch_lemma: 'opstaan',
        is_separable: true,
        prefix_part: 'op',
        root_verb: 'staan',
      }),
    ])
  })
})
