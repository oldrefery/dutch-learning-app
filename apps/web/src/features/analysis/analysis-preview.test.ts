import { parseWordAnalysis } from './analysis-contract'
import {
  buildAnalysisFromWordDetail,
  buildAnalysisPreview,
} from './analysis-preview'

describe('analysis preview', () => {
  it('maps analyzed linguistic data into the shared word card contract', () => {
    const analysis = parseWordAnalysis({
      dutch_original: 'het huis',
      dutch_lemma: 'huis',
      part_of_speech: 'noun',
      article: 'het',
      translations: { en: ['house'], ru: ['дом'] },
      tts_url: 'https://example.com/huis.mp3',
    })

    const preview = buildAnalysisPreview(analysis)
    expect(preview).toMatchObject({
      id: 'analysis-preview',
      collectionId: null,
      dutchLemma: 'huis',
      article: 'het',
      translations: { en: ['house'], ru: ['дом'] },
      intervalDays: 1,
      repetitionCount: 0,
      easinessFactor: 2.5,
      nextReviewDate: '',
      lastReviewedAt: null,
      createdAt: '',
      updatedAt: null,
    })
    expect(buildAnalysisFromWordDetail(preview)).toEqual(analysis)
  })

  it('normalizes unsupported persisted values before reanalysis', () => {
    const analysis = parseWordAnalysis({
      dutch_lemma: 'huis',
      translations: { en: ['house'] },
    })
    const word = buildAnalysisPreview(analysis)

    expect(
      buildAnalysisFromWordDetail({
        ...word,
        article: 'een',
        dutchOriginal: null,
        partOfSpeech: null,
        register: 'regional',
      })
    ).toMatchObject({
      article: null,
      dutchOriginal: 'huis',
      partOfSpeech: 'unknown',
      register: null,
    })
  })

  it.each([
    ['de', 'formal'],
    ['het', 'informal'],
    ['de', 'neutral'],
  ] as const)(
    'preserves supported article %s and register %s',
    (article, register) => {
      const analysis = parseWordAnalysis({
        dutch_lemma: 'woord',
        translations: { en: ['word'] },
      })
      const word = buildAnalysisPreview(analysis)

      expect(
        buildAnalysisFromWordDetail({ ...word, article, register })
      ).toMatchObject({ article, register })
    }
  )
})
