import { supabase } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'
import type { Collection, Word } from '@/types/database'
import { logSupabaseError } from '@/utils/logger'

export interface SharedCollectionData
  extends Pick<
    Collection,
    'collection_id' | 'name' | 'is_shared' | 'share_token' | 'shared_at'
  > {
  word_count: number
}

export interface SharedCollectionWords {
  collection: SharedCollectionData
  words: Omit<
    Word,
    | 'user_id'
    | 'interval_days'
    | 'repetition_count'
    | 'easiness_factor'
    | 'next_review_date'
    | 'last_reviewed_at'
  >[]
}

export interface CollectionShareStatus {
  is_shared: boolean
  share_token: string | null
  shared_at: string | null
}

type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

export enum CollectionSharingError {
  NOT_FOUND = 'COLLECTION_NOT_FOUND',
  NOT_SHARED = 'COLLECTION_NOT_SHARED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TOKEN_GENERATION_FAILED = 'TOKEN_GENERATION_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

class CollectionSharingService {
  async shareCollection(
    collectionId: string,
    userId: string
  ): Promise<Result<string, CollectionSharingError>> {
    try {
      const { data, error } = await supabase
        .from('collections')
        .update({
          is_shared: true,
          shared_at: new Date().toISOString(),
        })
        .eq('collection_id', collectionId)
        .eq('user_id', userId)
        .select('share_token')
        .single()

      if (error) {
        logSupabaseError('Failed to share collection', error, {
          operation: 'shareCollection',
          collectionId,
          userId,
        })

        return {
          success: false,
          error:
            error.code === 'PGRST116'
              ? CollectionSharingError.NOT_FOUND
              : CollectionSharingError.DATABASE_ERROR,
        }
      }

      if (!data?.share_token) {
        Sentry.captureMessage('Share token generation failed', {
          level: 'error',
          tags: { operation: 'shareCollection' },
          extra: { collectionId, userId },
        })

        return {
          success: false,
          error: CollectionSharingError.TOKEN_GENERATION_FAILED,
        }
      }

      Sentry.addBreadcrumb({
        category: 'collection',
        message: 'Collection shared successfully',
        data: { collectionId, shareToken: data.share_token },
        level: 'info',
      })

      return { success: true, data: data.share_token }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'shareCollection' },
        extra: { collectionId, userId },
      })

      return { success: false, error: CollectionSharingError.UNKNOWN_ERROR }
    }
  }

  async unshareCollection(
    collectionId: string,
    userId: string
  ): Promise<Result<void, CollectionSharingError>> {
    try {
      const { error } = await supabase
        .from('collections')
        .update({
          is_shared: false,
          shared_at: null,
        })
        .eq('collection_id', collectionId)
        .eq('user_id', userId)

      if (error) {
        logSupabaseError('Failed to unshare collection', error, {
          operation: 'unshareCollection',
          collectionId,
          userId,
        })

        return {
          success: false,
          error:
            error.code === 'PGRST116'
              ? CollectionSharingError.NOT_FOUND
              : CollectionSharingError.DATABASE_ERROR,
        }
      }

      Sentry.addBreadcrumb({
        category: 'collection',
        message: 'Collection unshared successfully',
        data: { collectionId },
        level: 'info',
      })

      return { success: true, data: undefined }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'unshareCollection' },
        extra: { collectionId, userId },
      })

      return { success: false, error: CollectionSharingError.UNKNOWN_ERROR }
    }
  }

  async getSharedCollection(
    shareToken: string
  ): Promise<Result<SharedCollectionData, CollectionSharingError>> {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select(
          `
          collection_id,
          name,
          is_shared,
          share_token,
          shared_at
        `
        )
        .eq('share_token', shareToken)
        .eq('is_shared', true)
        .maybeSingle()

      if (error) {
        logSupabaseError('Failed to fetch shared collection', error, {
          operation: 'getSharedCollection',
          shareToken,
        })

        return { success: false, error: CollectionSharingError.DATABASE_ERROR }
      }

      if (!data) {
        return { success: false, error: CollectionSharingError.NOT_FOUND }
      }

      const { count, error: countError } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', data.collection_id)

      if (countError) {
        logSupabaseError(
          'Failed to fetch word count for shared collection',
          countError,
          {
            operation: 'getSharedCollection',
            shareToken,
            collectionId: data.collection_id,
          }
        )
      }

      const result: SharedCollectionData = {
        collection_id: data.collection_id,
        name: data.name,
        is_shared: data.is_shared,
        share_token: data.share_token,
        shared_at: data.shared_at,
        word_count: count ?? 0,
      }

      return { success: true, data: result }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getSharedCollection' },
        extra: { shareToken },
      })

      return { success: false, error: CollectionSharingError.UNKNOWN_ERROR }
    }
  }

  async getSharedCollectionWords(
    shareToken: string
  ): Promise<Result<SharedCollectionWords, CollectionSharingError>> {
    try {
      const collectionResult = await this.getSharedCollection(shareToken)

      if (!collectionResult.success) {
        return { success: false, error: collectionResult.error }
      }

      const { data: words, error: wordsError } = await supabase
        .from('words')
        .select(
          `
          word_id,
          collection_id,
          dutch_lemma,
          dutch_original,
          part_of_speech,
          is_irregular,
          is_reflexive,
          is_expression,
          expression_type,
          is_separable,
          prefix_part,
          root_verb,
          article,
          plural,
          translations,
          examples,
          synonyms,
          antonyms,
          conjugation,
          preposition,
          image_url,
          tts_url,
          analysis_notes,
          created_at
        `
        )
        .eq('collection_id', collectionResult.data.collection_id)
        .order('created_at', { ascending: true })

      if (wordsError) {
        logSupabaseError('Failed to fetch collection words', wordsError, {
          operation: 'getSharedCollectionWords',
          shareToken,
          collectionId: collectionResult.data.collection_id,
        })

        return { success: false, error: CollectionSharingError.DATABASE_ERROR }
      }

      const result: SharedCollectionWords = {
        collection: collectionResult.data,
        words: words || [],
      }

      return { success: true, data: result }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getSharedCollectionWords' },
        extra: { shareToken },
      })

      return { success: false, error: CollectionSharingError.UNKNOWN_ERROR }
    }
  }

  async getCollectionShareStatus(
    collectionId: string,
    userId: string
  ): Promise<Result<CollectionShareStatus, CollectionSharingError>> {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('is_shared, share_token, shared_at')
        .eq('collection_id', collectionId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        logSupabaseError('Failed to fetch collection share status', error, {
          operation: 'getCollectionShareStatus',
          collectionId,
          userId,
        })

        return { success: false, error: CollectionSharingError.DATABASE_ERROR }
      }

      if (!data) {
        return { success: false, error: CollectionSharingError.NOT_FOUND }
      }

      const result: CollectionShareStatus = {
        is_shared: data.is_shared ?? false,
        share_token: data.share_token ?? null,
        shared_at: data.shared_at ?? null,
      }

      return { success: true, data: result }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getCollectionShareStatus' },
        extra: { collectionId, userId },
      })

      return { success: false, error: CollectionSharingError.UNKNOWN_ERROR }
    }
  }

  generateShareUrl(shareToken: string): string {
    return `dutchlearning://share/${shareToken}`
  }

  generateWebShareUrl(shareToken: string): string {
    // TODO: Implement web version for Universal Links
    // This will be a Next.js app that handles shared collection imports
    // and redirects to app if installed, or shows web preview if not
    return `https://dutch-learning-app.vercel.app/share/${shareToken}`
  }
}

export const collectionSharingService = new CollectionSharingService()

export default collectionSharingService
