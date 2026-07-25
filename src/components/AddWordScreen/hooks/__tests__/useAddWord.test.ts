import { act, renderHook, waitFor } from '@testing-library/react-native'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useCollections } from '@/hooks/useCollections'
import { useAddWord } from '../useAddWord'
import type { Collection, GeminiWordAnalysis, Word } from '@/types/database'

jest.mock('@/components/AppToast', () => ({
  ToastService: {
    show: jest.fn(),
  },
}))

jest.mock('@/stores/useApplicationStore')
jest.mock('@/stores/useSettingsStore')
jest.mock('@/hooks/useCollections')

describe('useAddWord', () => {
  const timestamp = '2026-04-27T00:00:00.000Z'
  const collection: Collection = {
    collection_id: 'collection-1',
    user_id: 'user-1',
    name: 'My Words',
    description: null,
    updated_at: timestamp,
    created_at: timestamp,
    is_shared: false,
    shared_with: null,
    share_token: null,
    shared_at: null,
  }

  const analysis: GeminiWordAnalysis = {
    dutch_lemma: 'lopen',
    part_of_speech: 'verb',
    translations: { en: ['walk'] },
    examples: [{ nl: 'Ik loop.', en: 'I walk.' }],
  }

  const savedWord: Word = {
    word_id: 'word-1',
    user_id: 'user-1',
    collection_id: collection.collection_id,
    dutch_lemma: 'lopen',
    dutch_original: null,
    part_of_speech: 'verb',
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    expression_type: null,
    is_separable: false,
    prefix_part: null,
    root_verb: null,
    article: null,
    plural: null,
    register: null,
    translations: { en: ['walk'] },
    examples: [{ nl: 'Ik loop.', en: 'I walk.' }],
    synonyms: [],
    antonyms: [],
    conjugation: null,
    preposition: null,
    image_url: null,
    tts_url: null,
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: '2026-04-28',
    last_reviewed_at: null,
    analysis_notes: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  const saveAnalyzedWord = jest.fn()
  const clearError = jest.fn()
  const setLastSelectedCollectionId = jest.fn()
  const createNewCollection = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      saveAnalyzedWord,
      clearError,
    })
    ;(
      useApplicationStore as unknown as {
        getState: jest.Mock
      }
    ).getState = jest.fn(() => ({
      createNewCollection,
    }))
    ;(useCollections as jest.Mock).mockReturnValue({
      collections: [collection],
    })
    ;(
      useSettingsStore as unknown as {
        persist: {
          hasHydrated: jest.Mock
          onFinishHydration: jest.Mock
        }
        getState: jest.Mock
      }
    ).persist = {
      hasHydrated: jest.fn(() => true),
      onFinishHydration: jest.fn(),
    }
    ;(
      useSettingsStore as unknown as {
        getState: jest.Mock
      }
    ).getState = jest.fn(() => ({
      lastSelectedCollectionId: null,
      setLastSelectedCollectionId,
    }))
  })

  it('shows success only after saveAnalyzedWord returns a saved word', async () => {
    const persistedWord = {
      ...savedWord,
      dutch_lemma: 'persisted lopen',
    }
    saveAnalyzedWord.mockResolvedValue(persistedWord)

    const { result } = renderHook(() => useAddWord())

    await waitFor(() => {
      expect(result.current.selectedCollection).toEqual(collection)
    })

    await act(async () => {
      await expect(result.current.addWord(analysis)).resolves.toBe(true)
    })

    expect(saveAnalyzedWord).toHaveBeenCalledWith(
      analysis,
      collection.collection_id
    )
    expect(ToastService.show).toHaveBeenCalledWith(
      '"persisted lopen" added to "My Words"',
      ToastType.SUCCESS
    )
    expect(ToastService.show).not.toHaveBeenCalledWith(
      '"lopen" added to "My Words"',
      ToastType.SUCCESS
    )
  })

  it('does not show success when saveAnalyzedWord rejects', async () => {
    saveAnalyzedWord.mockRejectedValue(new Error('Save failed'))

    const { result } = renderHook(() => useAddWord())

    await waitFor(() => {
      expect(result.current.selectedCollection).toEqual(collection)
    })

    await act(async () => {
      await expect(result.current.addWord(analysis)).resolves.toBe(false)
    })

    expect(ToastService.show).toHaveBeenCalledWith(
      'Save failed',
      ToastType.ERROR
    )
    expect(ToastService.show).not.toHaveBeenCalledWith(
      expect.stringContaining('added to'),
      ToastType.SUCCESS
    )
  })

  it('does not show success when save fails after creating a collection', async () => {
    ;(useCollections as jest.Mock).mockReturnValue({
      collections: [],
    })
    createNewCollection.mockResolvedValue(collection)
    saveAnalyzedWord.mockRejectedValue(
      new Error('Save failed after collection creation')
    )

    const { result } = renderHook(() => useAddWord())

    await act(async () => {
      await expect(result.current.addWord(analysis)).resolves.toBe(false)
    })

    expect(createNewCollection).toHaveBeenCalledWith('My Words')
    expect(setLastSelectedCollectionId).toHaveBeenCalledWith(
      collection.collection_id
    )
    expect(saveAnalyzedWord).toHaveBeenCalledWith(
      analysis,
      collection.collection_id
    )
    expect(ToastService.show).toHaveBeenCalledWith(
      'Save failed after collection creation',
      ToastType.ERROR
    )
    expect(ToastService.show).not.toHaveBeenCalledWith(
      expect.stringContaining('added to'),
      ToastType.SUCCESS
    )
  })

  it('preserves duplicate rejection messages', async () => {
    saveAnalyzedWord.mockRejectedValue(
      new Error('Word "lopen" already exists in your collection')
    )

    const { result } = renderHook(() => useAddWord())

    await waitFor(() => {
      expect(result.current.selectedCollection).toEqual(collection)
    })

    await act(async () => {
      await expect(result.current.addWord(analysis)).resolves.toBe(false)
    })

    expect(ToastService.show).toHaveBeenCalledWith(
      'Word "lopen" already exists in your collection',
      ToastType.ERROR
    )
  })
})
