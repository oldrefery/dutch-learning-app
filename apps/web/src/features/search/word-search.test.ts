import { buildWordSearchResults, normalizeWordSearchQuery } from './word-search'

const collections = [{ collection_id: 'collection-1', name: 'Essentials' }]
const rows = [
  {
    collection_id: 'collection-1',
    dutch_lemma: 'uitwaaien',
    dutch_original: 'uitwaaien',
    part_of_speech: 'verb',
    translations: {
      en: ['to get some fresh air'],
      ru: ['проветриться'],
    },
    word_id: 'word-1',
  },
]

describe('word search', () => {
  it('normalizes whitespace and length', () => {
    expect(normalizeWordSearchQuery('  UIT   waaien  ')).toBe('uit waaien')
    expect(normalizeWordSearchQuery('a'.repeat(100))).toHaveLength(80)
  })

  it.each(['uitwaai', 'fresh air', 'проветр'])(
    'matches Dutch and translated text for %s',
    query => {
      expect(buildWordSearchResults(rows, collections, query)).toEqual([
        {
          collectionId: 'collection-1',
          collectionName: 'Essentials',
          dutchLemma: 'uitwaaien',
          partOfSpeech: 'verb',
          primaryTranslation: 'to get some fresh air',
          wordId: 'word-1',
        },
      ])
    }
  )

  it('returns no results for an empty normalized query', () => {
    expect(buildWordSearchResults(rows, collections, '   ')).toEqual([])
  })

  it('filters malformed translations and supplies display fallbacks', () => {
    const malformedRows = [
      {
        collection_id: 'collection-1',
        dutch_lemma: 'appel',
        dutch_original: null,
        part_of_speech: null,
        translations: {
          metadata: 'not-a-list',
          en: ['apple', 42, null],
        },
        word_id: 'word-2',
      },
      {
        collection_id: 'collection-1',
        dutch_lemma: 'banaan',
        dutch_original: null,
        part_of_speech: null,
        translations: 'invalid',
        word_id: 'word-3',
      },
    ]

    expect(buildWordSearchResults(malformedRows, collections, 'apple')).toEqual(
      [
        {
          collectionId: 'collection-1',
          collectionName: 'Essentials',
          dutchLemma: 'appel',
          partOfSpeech: 'other',
          primaryTranslation: 'apple',
          wordId: 'word-2',
        },
      ]
    )
    expect(
      buildWordSearchResults(malformedRows, collections, 'banaan')
    ).toEqual([
      {
        collectionId: 'collection-1',
        collectionName: 'Essentials',
        dutchLemma: 'banaan',
        partOfSpeech: 'other',
        primaryTranslation: 'Translation unavailable',
        wordId: 'word-3',
      },
    ])
  })

  it('filters orphaned rows before sorting and limiting results', () => {
    const sortableRows = [
      { ...rows[0], dutch_lemma: 'zebra', word_id: 'word-z' },
      { ...rows[0], dutch_lemma: 'appel', word_id: 'word-a' },
      { ...rows[0], collection_id: null, dutch_lemma: 'aardbei' },
      { ...rows[0], collection_id: 'missing', dutch_lemma: 'aap' },
    ]

    expect(buildWordSearchResults(sortableRows, collections, 'a', 1)).toEqual([
      expect.objectContaining({ dutchLemma: 'appel', wordId: 'word-a' }),
    ])
  })

  it.each([null, undefined, false, 42, 'invalid'])(
    'keeps words searchable without a translations object: %j',
    translations => {
      expect(
        buildWordSearchResults(
          [{ ...rows[0], translations }],
          collections,
          'uitwaai'
        )
      ).toEqual([
        expect.objectContaining({
          primaryTranslation: 'Translation unavailable',
        }),
      ])
    }
  )

  it('searches the original inflected form, but never invents one when absent', () => {
    const word = {
      ...rows[0],
      dutch_lemma: 'zijn',
      dutch_original: 'was',
      translations: {},
    }
    expect(buildWordSearchResults([word], collections, 'was')).toHaveLength(1)
    expect(
      buildWordSearchResults(
        [{ ...word, dutch_original: null }],
        collections,
        'was'
      )
    ).toEqual([])
  })

  it('applies the default forty-result limit after sorting', () => {
    const manyRows = Array.from({ length: 41 }, (_, index) => ({
      ...rows[0],
      word_id: `word-${index}`,
      dutch_lemma: `woord${String(index).padStart(2, '0')}`,
    })).reverse()
    const results = buildWordSearchResults(manyRows, collections, 'woord')
    expect(results).toHaveLength(40)
    expect(results[0].wordId).toBe('word-0')
    expect(results[39].wordId).toBe('word-39')
    expect(buildWordSearchResults(manyRows, collections, 'woord', 0)).toEqual(
      []
    )
  })
})
