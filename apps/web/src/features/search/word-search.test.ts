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
})
