import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useImportSelection } from '../useImportSelection'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { collectionSharingService } from '@/services/collectionSharingService'
import { supabase } from '@/lib/supabaseClient'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { Sentry } from '@/lib/sentry'

jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: {
    getState: jest.fn(),
  },
}))
jest.mock('@/services/collectionSharingService', () => ({
  collectionSharingService: {
    getSharedCollectionWords: jest.fn(),
  },
}))
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}))
jest.mock('@/components/AppToast', () => ({
  ToastService: {
    show: jest.fn(),
  },
}))
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
  },
}))
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    back: jest.fn(),
  },
}))

describe('useImportSelection', () => {
  const TARGET_COLLECTION_ID = 'target-collection-id'
  const SHARED_TOKEN = 'shared-token'
  const TEST_TIMESTAMP = '2026-02-24T00:00:00.000Z'
  const IMPORT_ACCESS_MESSAGE =
    'Unable to import words into the selected collection. Please verify access and try again.'

  const createSharedWord = () =>
    ({
      word_id: 'shared-word-id',
      collection_id: 'source-collection-id',
      dutch_lemma: 'huis',
      dutch_original: 'huis',
      part_of_speech: 'noun',
      is_irregular: false,
      is_reflexive: false,
      is_expression: false,
      expression_type: null,
      is_separable: false,
      prefix_part: null,
      root_verb: null,
      article: 'het',
      plural: 'huizen',
      translations: { en: ['house'] },
      examples: [],
      synonyms: [],
      antonyms: [],
      conjugation: null,
      preposition: null,
      image_url: null,
      tts_url: null,
      analysis_notes: null,
      created_at: TEST_TIMESTAMP,
      updated_at: TEST_TIMESTAMP,
    }) as any

  const createStoreState = (overrides: Record<string, unknown> = {}) => ({
    fetchCollections: jest.fn().mockResolvedValue(undefined),
    collections: [
      {
        collection_id: TARGET_COLLECTION_ID,
        name: 'Target',
      },
    ],
    words: [],
    error: null,
    addWordsToCollection: jest.fn().mockResolvedValue(true),
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    })
    ;(
      collectionSharingService.getSharedCollectionWords as jest.Mock
    ).mockResolvedValue({
      success: true,
      data: {
        collection: {
          collection_id: 'source-collection-id',
          name: 'Shared Collection',
          is_shared: true,
          share_token: SHARED_TOKEN,
          shared_at: TEST_TIMESTAMP,
          word_count: 1,
        },
        words: [createSharedWord()],
      },
    })
  })

  it('should show store-provided safe import error when import returns false', async () => {
    const storeState = createStoreState({
      addWordsToCollection: jest.fn().mockResolvedValue(false),
      error: {
        message: 'Failed to import words',
        details: IMPORT_ACCESS_MESSAGE,
      },
    })
    ;(useApplicationStore.getState as jest.Mock).mockImplementation(
      () => storeState
    )

    const { result } = renderHook(() => useImportSelection(SHARED_TOKEN))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.handleImport()
    })

    expect(ToastService.show).toHaveBeenCalledWith(
      IMPORT_ACCESS_MESSAGE,
      ToastType.ERROR
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should skip duplicate Sentry capture for sentryHandled import errors', async () => {
    const handledError = Object.assign(new Error('Handled import error'), {
      sentryHandled: true,
      userMessage: IMPORT_ACCESS_MESSAGE,
    })
    const storeState = createStoreState({
      addWordsToCollection: jest.fn().mockRejectedValue(handledError),
    })
    ;(useApplicationStore.getState as jest.Mock).mockImplementation(
      () => storeState
    )

    const { result } = renderHook(() => useImportSelection(SHARED_TOKEN))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.handleImport()
    })

    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(ToastService.show).toHaveBeenCalledWith(
      IMPORT_ACCESS_MESSAGE,
      ToastType.ERROR
    )
  })
})
