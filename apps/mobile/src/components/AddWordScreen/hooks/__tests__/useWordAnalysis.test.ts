import { act, renderHook } from '@testing-library/react-native'
import { wordService } from '@/lib/supabase'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { useWordAnalysis } from '../useWordAnalysis'

jest.mock('@/components/AppToast', () => ({
  ToastService: {
    show: jest.fn(),
  },
}))

jest.mock('@/lib/supabase', () => ({
  wordService: {
    analyzeWord: jest.fn(),
  },
}))

jest.mock('@/stores/useHistoryStore', () => ({
  useHistoryStore: {
    getState: jest.fn(),
  },
}))

describe('useWordAnalysis', () => {
  const addAnalyzedWord = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useHistoryStore.getState as jest.Mock).mockReturnValue({
      addAnalyzedWord,
    })
  })

  it('preserves usage notes from the analysis response for the word card', async () => {
    const usageNotes = {
      summary: 'Woning is common in formal housing contexts.',
      contrasts: [
        {
          term: 'huis',
          distinction: 'Huis is more common in everyday conversation.',
          example: {
            nl: 'Ik ben thuis in mijn huis.',
            en: 'I am at home in my house.',
          },
        },
      ],
    }

    ;(wordService.analyzeWord as jest.Mock).mockResolvedValue({
      data: {
        dutch_lemma: 'woning',
        part_of_speech: 'noun',
        translations: { en: ['dwelling'], ru: ['жильё'] },
        examples: [],
        usage_notes: usageNotes,
      },
      meta: { source: 'gemini', cache_hit: false },
    })

    const { result } = renderHook(() => useWordAnalysis())

    await act(async () => {
      await result.current.analyzeWord(' Woning ')
    })

    expect(wordService.analyzeWord).toHaveBeenCalledWith('woning', {
      forceRefresh: false,
    })
    expect(result.current.analysisResult?.usage_notes).toEqual(usageNotes)
  })
  it('analyzes a personal word while following reads remain enabled', async () => {
    process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
    try {
      jest.mocked(wordService.analyzeWord).mockResolvedValue({
        success: true,
        data: {
          dutch_lemma: 'huis',
          part_of_speech: 'noun',
          translations: { en: ['house'] },
          examples: [],
        },
      })
      const { result } = renderHook(() => useWordAnalysis())
      await act(async () => result.current.analyzeWord('huis'))
      expect(result.current.analysisError).toBeNull()
      expect(result.current.analysisResult?.dutch_lemma).toBe('huis')
      expect(wordService.analyzeWord).toHaveBeenCalledWith('huis', {
        forceRefresh: false,
      })
      expect(addAnalyzedWord).toHaveBeenCalledWith('huis', 'huis')
    } finally {
      delete process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED
      delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
    }
  })
})
