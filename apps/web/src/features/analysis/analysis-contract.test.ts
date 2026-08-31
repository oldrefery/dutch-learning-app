import {
  mergeWordImageOptions,
  normalizeDutchInput,
  parseAnalysisFunctionResponse,
  parseImageFunctionResponse,
  parseSerializedWordAnalysis,
  serializeWordAnalysis,
} from './analysis-contract'

const completeAnalysis = {
  dutch_original: 'Het huis',
  dutch_lemma: 'Huis',
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'], ru: ['дом'] },
  examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.' }],
  image_url: 'https://images.unsplash.com/photo-1',
  tts_url: 'https://example.com/huis.mp3',
  register: 'neutral',
  usage_notes: {
    summary: 'A common noun.',
    contrasts: [
      {
        term: 'thuis',
        distinction: 'Means at home.',
        example: { nl: 'Ik ben thuis.', en: 'I am at home.' },
      },
    ],
  },
}

describe('analysis contract', () => {
  it('normalizes the mobile Dutch input contract', () => {
    expect(normalizeDutchInput('  Het   huis. ')).toEqual({
      value: 'Het huis',
      error: null,
    })
    expect(normalizeDutchInput('huis_1').error).toMatch(/Dutch letters/)
  })

  it('parses a complete Edge Function response', () => {
    const result = parseAnalysisFunctionResponse({
      success: true,
      data: completeAnalysis,
      meta: { source: 'cache', cache_hit: true, usage_count: 4 },
    })

    expect(result).toMatchObject({
      analysis: {
        dutchLemma: 'huis',
        article: 'het',
        translations: { en: ['house'], ru: ['дом'] },
        usageNotes: { summary: 'A common noun.' },
      },
      metadata: { source: 'cache', cacheHit: true, usageCount: 4 },
    })
  })

  it('rejects incomplete analysis and unsafe URLs', () => {
    expect(() =>
      parseAnalysisFunctionResponse({
        success: true,
        data: { dutch_lemma: 'huis', translations: { en: [] } },
      })
    ).toThrow('incomplete')

    const result = parseAnalysisFunctionResponse({
      success: true,
      data: {
        ...completeAnalysis,
        image_url: 'javascript:alert(1)',
        tts_url: 'http://example.com/huis.mp3',
      },
    })
    expect(result.analysis.imageUrl).toBeNull()
    expect(result.analysis.ttsUrl).toBeNull()
  })

  it('round-trips analysis through the untrusted form payload parser', () => {
    const analysis = parseAnalysisFunctionResponse({
      success: true,
      data: completeAnalysis,
    }).analysis

    expect(
      parseSerializedWordAnalysis(serializeWordAnalysis(analysis))
    ).toEqual(analysis)
  })

  it('filters malformed image options', () => {
    expect(
      parseImageFunctionResponse({
        images: [
          { url: 'https://picsum.photos/400/300', alt: 'House' },
          { url: 'javascript:alert(1)', alt: 'Unsafe' },
          null,
        ],
      })
    ).toEqual([{ url: 'https://picsum.photos/400/300', alt: 'House' }])
  })

  it('deduplicates paginated image results by URL', () => {
    expect(
      mergeWordImageOptions(
        [{ url: 'https://picsum.photos/1', alt: 'First' }],
        [
          { url: 'https://picsum.photos/1', alt: 'Updated' },
          { url: 'https://picsum.photos/2', alt: 'Second' },
        ]
      )
    ).toEqual([
      { url: 'https://picsum.photos/1', alt: 'Updated' },
      { url: 'https://picsum.photos/2', alt: 'Second' },
    ])
  })
})
