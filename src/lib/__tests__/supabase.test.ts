import * as Sentry from '@sentry/react-native'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { collectionService, supabase, wordService } from '../supabase'
import { ErrorCategory, ErrorSeverity, NetworkError } from '@/types/ErrorTypes'
import { assertNetworkConnection } from '@/utils/network'
import { logSupabaseError, logWarning } from '@/utils/logger'

jest.mock('@/lib/supabaseClient')
jest.mock('@/utils/network', () => ({
  assertNetworkConnection: jest.fn(),
}))
jest.mock('@/utils/logger', () => ({
  logSupabaseError: jest.fn(),
  logWarning: jest.fn(),
}))

interface SupabaseFunctionsMock {
  functions: {
    invoke: jest.Mock
  }
}

const mockedAssertNetworkConnection =
  assertNetworkConnection as jest.MockedFunction<typeof assertNetworkConnection>
const COLLECTION_ID = 'collection-id'
const USER_ID = 'user-id'
const SERVER_WORD_ID = 'server-word-id'

const getSupabaseFunctionsMock = (): SupabaseFunctionsMock =>
  supabase as unknown as SupabaseFunctionsMock

const createFunctionsHttpError = (
  status: number,
  body: Record<string, unknown>
): FunctionsHttpError =>
  new FunctionsHttpError({
    status,
    json: jest.fn().mockResolvedValue(body),
  })

describe('wordService duplicate handling', () => {
  const DUTCH_LEMMA = 'huis'
  const SEMANTIC_DUPLICATE_MESSAGE =
    'duplicate key value violates unique constraint "idx_words_semantic_unique"'

  beforeEach(() => {
    jest.clearAllMocks()
    mockedAssertNetworkConnection.mockResolvedValue(undefined)
  })

  it('should match mixed-case semantic duplicates when article is empty in DB', async () => {
    const result = {
      data: [
        {
          word_id: SERVER_WORD_ID,
          dutch_lemma: 'HUIS',
          collection_id: COLLECTION_ID,
          part_of_speech: null,
          article: '',
        },
      ],
      error: null,
    }
    const is = jest.fn().mockResolvedValue(result)
    const ilike = jest.fn().mockReturnValue({ is })
    const selectChain = {
      eq: jest.fn().mockReturnValue({ ilike }),
    }

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue(selectChain),
    })

    const existingWord = await wordService.checkWordExists(
      USER_ID,
      DUTCH_LEMMA,
      undefined,
      undefined
    )

    expect(existingWord).toEqual(
      expect.objectContaining({ word_id: SERVER_WORD_ID })
    )
    expect(ilike).toHaveBeenCalledWith('dutch_lemma', DUTCH_LEMMA)
    expect(is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('should escape ILIKE wildcards in every semantic duplicate lookup', async () => {
    const result = { data: [], error: null }
    const is = jest.fn().mockResolvedValue(result)
    const ilike = jest.fn().mockReturnValue({ is })
    const selectChain = {
      eq: jest.fn().mockReturnValue({ ilike }),
    }

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue(selectChain),
    })

    await wordService.checkSemanticDuplicate(
      USER_ID,
      '%Huis_',
      undefined,
      undefined
    )

    expect(ilike).toHaveBeenCalledWith('dutch_lemma', '\\%huis\\_')
  })

  it('should find a pre-analysis duplicate by exact escaped lemma', async () => {
    const existingWord = {
      word_id: SERVER_WORD_ID,
      dutch_lemma: '%Huis_',
      collection_id: COLLECTION_ID,
      part_of_speech: 'noun',
      article: 'het',
    }
    const limit = jest.fn().mockResolvedValue({
      data: [existingWord],
      error: null,
    })
    const is = jest.fn().mockReturnValue({ limit })
    const ilike = jest.fn().mockReturnValue({ is })
    const eq = jest.fn().mockReturnValue({ ilike })

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({ eq }),
    })

    await expect(
      wordService.findWordByLemma(USER_ID, '  %Huis_  ')
    ).resolves.toEqual(existingWord)
    expect(mockedAssertNetworkConnection).toHaveBeenCalledTimes(1)
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(ilike).toHaveBeenCalledWith('dutch_lemma', '\\%huis\\_')
    expect(is).toHaveBeenCalledWith('deleted_at', null)
    expect(limit).toHaveBeenCalledWith(1)
  })

  it('should downgrade semantic duplicate import error to warning-level Sentry message', async () => {
    const duplicateError = {
      code: '23505',
      message: SEMANTIC_DUPLICATE_MESSAGE,
      details: 'Key already exists',
    }

    ;(supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: duplicateError,
    })

    await expect(
      wordService.importWordsToCollection(COLLECTION_ID, [
        { dutch_lemma: DUTCH_LEMMA },
      ])
    ).rejects.toMatchObject({
      message: SEMANTIC_DUPLICATE_MESSAGE,
      code: '23505',
      sentryHandled: true,
    })

    expect(logWarning).toHaveBeenCalledWith(
      'Semantic duplicate skipped during word import',
      expect.objectContaining({
        operation: 'importWordsToCollection',
        collectionId: COLLECTION_ID,
      })
    )
    expect(logSupabaseError).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Semantic duplicate skipped during import RPC',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          import_error_type: 'semantic_duplicate',
        }),
      })
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should capture import access denial as one warning and return safe message', async () => {
    const accessDeniedError = {
      code: 'P0001',
      message: 'Collection not found or access denied [P0001]',
      details: 'Import blocked by policy',
    }

    ;(supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: accessDeniedError,
    })

    await expect(
      wordService.importWordsToCollection(COLLECTION_ID, [
        { dutch_lemma: DUTCH_LEMMA },
      ])
    ).rejects.toMatchObject({
      message:
        'Unable to import words into the selected collection. Please verify access and try again.',
      code: 'P0001',
      sentryHandled: true,
      isImportAccessError: true,
    })

    expect(logSupabaseError).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Import blocked by access policy',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          import_error_type: 'access_denied',
        }),
      })
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should rely on logSupabaseError capture for non-duplicate import errors', async () => {
    const genericError = {
      code: 'PGRST204',
      message: 'Database error',
      details: 'Something failed',
    }

    ;(supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: genericError,
    })

    await expect(
      wordService.importWordsToCollection(COLLECTION_ID, [
        { dutch_lemma: DUTCH_LEMMA },
      ])
    ).rejects.toMatchObject({
      message: 'Database error',
      code: 'PGRST204',
      sentryHandled: true,
    })

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})

describe('soft delete services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAssertNetworkConnection.mockResolvedValue(undefined)
  })

  it('should preserve a word tombstone instead of hard deleting it', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq })
    ;(supabase.from as jest.Mock).mockReturnValue({ update })

    await wordService.deleteWord('word-id')

    expect(update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
    })
    expect(eq).toHaveBeenCalledWith('word_id', 'word-id')
  })

  it('should tombstone collection words before deleting the collection', async () => {
    const wordsUserEq = jest.fn().mockResolvedValue({ error: null })
    const wordsCollectionEq = jest.fn().mockReturnValue({ eq: wordsUserEq })
    const wordsUpdate = jest.fn().mockReturnValue({ eq: wordsCollectionEq })
    const collectionUserEq = jest.fn().mockResolvedValue({ error: null })
    const collectionIdEq = jest.fn().mockReturnValue({ eq: collectionUserEq })
    const collectionDelete = jest.fn().mockReturnValue({ eq: collectionIdEq })

    ;(supabase.from as jest.Mock).mockImplementation((tableName: string) =>
      tableName === 'words'
        ? { update: wordsUpdate }
        : { delete: collectionDelete }
    )

    await collectionService.deleteCollection(COLLECTION_ID, USER_ID)

    expect(wordsUpdate).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
    })
    expect(wordsCollectionEq).toHaveBeenCalledWith(
      'collection_id',
      COLLECTION_ID
    )
    expect(wordsUserEq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(collectionDelete).toHaveBeenCalled()
  })
})

describe('wordService analyzeWord Edge Function error handling', () => {
  const INVALID_WORD_MESSAGE =
    'Invalid word input. Please provide a valid Dutch word.'
  const GEMINI_API_ERROR = 'Gemini API error'

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockedAssertNetworkConnection.mockResolvedValue(undefined)
    getSupabaseFunctionsMock().functions = {
      invoke: jest.fn(),
    }
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should classify Edge Function 400 invalid input as validation without Sentry exception capture', async () => {
    getSupabaseFunctionsMock().functions.invoke.mockResolvedValue({
      data: null,
      error: createFunctionsHttpError(400, {
        success: false,
        error: INVALID_WORD_MESSAGE,
      }),
    })

    await expect(
      wordService.analyzeWord('opstaan/slapen')
    ).rejects.toMatchObject({
      name: 'ValidationError',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.INFO,
      field: 'word',
      message: INVALID_WORD_MESSAGE,
      userMessage: INVALID_WORD_MESSAGE,
      isRetryable: false,
    })

    expect(getSupabaseFunctionsMock().functions.invoke).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should keep expected offline preflight failures out of Sentry exception capture', async () => {
    const offlineError = new NetworkError(
      'Internet not reachable',
      'Cannot reach the internet. Please check your connection.',
      undefined,
      {
        networkState: {
          isConnected: true,
          isInternetReachable: false,
        },
      }
    )
    mockedAssertNetworkConnection.mockRejectedValueOnce(offlineError)

    await expect(wordService.analyzeWord('huis')).rejects.toMatchObject({
      name: 'NetworkError',
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.WARNING,
      message: 'Internet not reachable',
      isRetryable: true,
    })

    expect(getSupabaseFunctionsMock().functions.invoke).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should keep Edge Function 500 failures as captured server errors', async () => {
    getSupabaseFunctionsMock().functions.invoke.mockResolvedValue({
      data: null,
      error: createFunctionsHttpError(500, {
        success: false,
        error: GEMINI_API_ERROR,
      }),
    })

    await expect(wordService.analyzeWord('huis')).rejects.toMatchObject({
      name: 'ServerError',
      category: ErrorCategory.SERVER,
      severity: ErrorSeverity.ERROR,
      message: GEMINI_API_ERROR,
      userMessage: 'Word analysis failed. Please try again.',
      isRetryable: false,
      statusCode: 500,
    })

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ServerError',
        message: GEMINI_API_ERROR,
      }),
      expect.objectContaining({
        tags: expect.objectContaining({
          operation: 'analyzeWord',
          errorCategory: ErrorCategory.SERVER,
          severity: ErrorSeverity.ERROR,
        }),
        level: 'error',
      })
    )
  })
})
