import { createClient } from '@/lib/supabase/client'
import { recordAnalysisHistory } from '@/features/history/analysis-history'
import {
  analyzeWordWithAi,
  findWordImages,
  getNextImageOffset,
} from './analysis-client'
import type { WordAnalysis } from './analysis-contract'

const mockInvoke = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    functions: { invoke: mockInvoke },
  })),
}))

jest.mock('@/features/history/analysis-history', () => ({
  recordAnalysisHistory: jest.fn(),
}))

const analysisResponse = {
  success: true,
  data: {
    dutch_original: 'Het huis',
    dutch_lemma: 'huis',
    part_of_speech: 'noun',
    article: 'het',
    translations: { en: ['house'] },
    examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.' }],
  },
}

describe('analysis client', () => {
  beforeEach(() => mockInvoke.mockReset())

  test('analyzes a word and records successful history', async () => {
    mockInvoke.mockResolvedValue({ data: analysisResponse, error: null })

    const result = await analyzeWordWithAi('user-1', 'huis', true)

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('gemini-handler', {
      body: { word: 'huis', forceRefresh: true },
    })
    expect(result.analysis.dutchLemma).toBe('huis')
    expect(recordAnalysisHistory).toHaveBeenCalledWith('user-1', 'huis', result)
  })

  test('requests and parses a page of image options', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        images: [{ url: 'https://picsum.photos/house', alt: 'House' }],
      },
      error: null,
    })
    const analysis = {
      partOfSpeech: 'noun',
      translations: { en: ['house'] },
      examples: [
        { nl: 'Mijn huis.', en: 'My house.', ru: 'Мой дом.' },
        { nl: 'Een huis.', en: 'A house.' },
      ],
    } as WordAnalysis

    await expect(findWordImages(analysis, 6)).resolves.toEqual([
      { url: 'https://picsum.photos/house', alt: 'House' },
    ])
    expect(mockInvoke).toHaveBeenCalledWith('get-multiple-images', {
      body: {
        englishTranslation: 'house',
        partOfSpeech: 'noun',
        examples: [
          { nl: 'Mijn huis.', en: 'My house.', ru: 'Мой дом.' },
          { nl: 'Een huis.', en: 'A house.' },
        ],
        count: 6,
        offset: 6,
      },
    })
    expect(getNextImageOffset(6)).toBe(12)
  })

  test('exposes invocation errors without writing history', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Service unavailable'),
    })

    await expect(analyzeWordWithAi('user-1', 'huis')).rejects.toThrow(
      'Service unavailable'
    )
    expect(recordAnalysisHistory).not.toHaveBeenCalled()
  })
})
