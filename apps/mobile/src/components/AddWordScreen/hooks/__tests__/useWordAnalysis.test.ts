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

    const { result } = await renderHook(() => useWordAnalysis())

    await act(async () => {
      await result.current.analyzeWord(' Woning ')
    })

    expect(wordService.analyzeWord).toHaveBeenCalledWith('woning', {
      forceRefresh: false,
      resolveVariants: true,
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
      const { result } = await renderHook(() => useWordAnalysis())
      await act(async () => result.current.analyzeWord('huis'))
      expect(result.current.analysisError).toBeNull()
      expect(result.current.analysisResult?.dutch_lemma).toBe('huis')
      expect(wordService.analyzeWord).toHaveBeenCalledWith('huis', {
        forceRefresh: false,
        resolveVariants: true,
      })
      expect(addAnalyzedWord).toHaveBeenCalledWith('huis', 'huis')
    } finally {
      delete process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED
      delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
    }
  })
  it('previews variants without saving analysis history and refreshes the selected adjective', async () => {
    const adjective = {
      lemma: 'overleden',
      partOfSpeech: 'adjective',
      translations: { en: 'deceased', ru: 'покойный' },
    }
    const verb = {
      lemma: 'overlijden',
      partOfSpeech: 'verb',
      translations: { en: 'to pass away', ru: 'скончаться' },
    }
    const response = {
      success: true,
      data: {
        dutch_lemma: 'overleden',
        part_of_speech: 'adjective',
        translations: { en: ['deceased'], ru: ['покойный'] },
      },
    }
    const service = jest.mocked(wordService.analyzeWord)
    service
      .mockResolvedValueOnce({ success: true, choices: [adjective, verb] })
      .mockResolvedValueOnce(response)
      .mockResolvedValueOnce(response)
    const { result } = await renderHook(() => useWordAnalysis())
    await act(async () => result.current.analyzeWord('overleden'))
    expect(result.current.choices).toEqual([adjective, verb])
    expect(addAnalyzedWord).not.toHaveBeenCalled()

    await act(async () =>
      result.current.analyzeWord('overleden', false, adjective)
    )
    expect(result.current.analysisResult?.part_of_speech).toBe('adjective')
    expect(result.current.choices).toEqual([])
    await act(async () => result.current.forceRefreshAnalysis('overleden'))
    expect(service).toHaveBeenLastCalledWith('overleden', {
      forceRefresh: true,
      resolveVariants: true,
      selectedVariant: { lemma: 'overleden', partOfSpeech: 'adjective' },
    })
  })
})
