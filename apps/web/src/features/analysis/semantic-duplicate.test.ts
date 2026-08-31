import { parseWordAnalysis } from './analysis-contract'
import { isSemanticWordMatch } from './semantic-duplicate'

const analysis = parseWordAnalysis({
  dutch_lemma: 'huis',
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'] },
})

describe('semantic duplicate matching', () => {
  it('matches the case-insensitive database uniqueness key', () => {
    expect(
      isSemanticWordMatch(
        { dutch_lemma: 'HUIS', part_of_speech: 'noun', article: 'het' },
        analysis
      )
    ).toBe(true)
  })

  it('keeps article and part of speech variants distinct', () => {
    expect(
      isSemanticWordMatch(
        { dutch_lemma: 'huis', part_of_speech: 'verb', article: 'het' },
        analysis
      )
    ).toBe(false)
    expect(
      isSemanticWordMatch(
        { dutch_lemma: 'huis', part_of_speech: 'noun', article: 'de' },
        analysis
      )
    ).toBe(false)
  })
})
