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
      dutchLemma: 'huis',
      article: 'het',
      translations: { en: ['house'], ru: ['дом'] },
      repetitionCount: 0,
    })
    expect(buildAnalysisFromWordDetail(preview)).toEqual(analysis)
  })
})
