import * as Sentry from '@sentry/react-native'
import { supabase, wordService } from '../supabase'
import { logSupabaseError, logWarning } from '@/utils/logger'

jest.mock('@/lib/supabaseClient')
jest.mock('@/utils/logger', () => ({
  logSupabaseError: jest.fn(),
  logWarning: jest.fn(),
}))

describe('wordService duplicate handling', () => {
  const COLLECTION_ID = 'collection-id'
  const DUTCH_LEMMA = 'huis'
  const SEMANTIC_DUPLICATE_MESSAGE =
    'duplicate key value violates unique constraint "idx_words_semantic_unique"'

  beforeEach(() => {
    jest.clearAllMocks()
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
    ).rejects.toEqual(duplicateError)

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
      expect.objectContaining({ level: 'warning' })
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should keep exception capture for non-duplicate import errors', async () => {
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
    ).rejects.toEqual(genericError)

    expect(logSupabaseError).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(genericError, {
      tags: { operation: 'importWordsToCollection' },
      extra: { collectionId: COLLECTION_ID, wordCount: 1 },
    })
  })
})
