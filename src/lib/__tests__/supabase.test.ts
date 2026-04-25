import * as Sentry from '@sentry/react-native'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, wordService } from '../supabase'
import { ErrorCategory, ErrorSeverity } from '@/types/ErrorTypes'
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

type SupabaseFunctionsMock = typeof supabase & {
  functions: {
    invoke: jest.Mock
  }
}

const mockedAssertNetworkConnection =
  assertNetworkConnection as jest.MockedFunction<typeof assertNetworkConnection>

const getSupabaseFunctionsMock = (): SupabaseFunctionsMock =>
  supabase as SupabaseFunctionsMock

const createFunctionsHttpError = (
  status: number,
  body: Record<string, unknown>
): FunctionsHttpError =>
  new FunctionsHttpError({
    status,
    json: jest.fn().mockResolvedValue(body),
  })

describe('wordService duplicate handling', () => {
  const COLLECTION_ID = 'collection-id'
  const DUTCH_LEMMA = 'huis'
  const SEMANTIC_DUPLICATE_MESSAGE =
    'duplicate key value violates unique constraint "idx_words_semantic_unique"'

  beforeEach(() => {
    jest.clearAllMocks()
    mockedAssertNetworkConnection.mockResolvedValue(undefined)
  })

  it('should match semantic duplicates when article is empty string in DB', async () => {
    const selectChain = {
      eq: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              word_id: 'server-word-id',
              dutch_lemma: DUTCH_LEMMA,
              collection_id: COLLECTION_ID,
              part_of_speech: null,
              article: '',
            },
          ],
          error: null,
        }),
      }),
    }

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue(selectChain),
    })

    const existingWord = await wordService.checkWordExists(
      'user-id',
      DUTCH_LEMMA,
      undefined,
      undefined
    )

    expect(existingWord).toEqual(
      expect.objectContaining({ word_id: 'server-word-id' })
    )
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
