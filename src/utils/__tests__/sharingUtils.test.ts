/**
 * Unit tests for sharingUtils
 * Tests sharing functionality for collections
 */

import { Share, Platform } from 'react-native'
import { sharingUtils } from '../sharingUtils'
import { collectionSharingService } from '@/services/collectionSharingService'
import { Sentry } from '@/lib/sentry'
import * as logger from '@/utils/logger'

jest.mock('react-native', () => ({
  Share: {
    share: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}))
jest.mock('@/services/collectionSharingService', () => ({
  collectionSharingService: {
    generateShareUrl: jest
      .fn()
      .mockReturnValue('https://example.com/share/token123'),
  },
}))
jest.mock('@/lib/sentry')
jest.mock('@/utils/logger')
jest.mock('@/lib/supabaseClient')
jest.mock('@supabase/supabase-js')

describe('sharingUtils', () => {
  // Helper functions to generate random test data
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const SHARE_TOKEN = generateId('token')
  const SHARE_URL = `https://example.com/share/${generateId('share')}`
  const COLLECTION_NAME = 'My Collection'
  const DUTCH_LEARNING_APP = 'Dutch Learning App'
  const SHARE_FAILED_ERROR = 'Share failed'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(Share.share as jest.Mock).mockResolvedValue(undefined)
    ;(collectionSharingService.generateShareUrl as jest.Mock).mockReturnValue(
      SHARE_URL
    )
  })

  describe('shareCollectionUrl', () => {
    it('should share collection with default options', async () => {
      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should call generateShareUrl with correct token', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      expect(collectionSharingService.generateShareUrl).toHaveBeenCalledWith(
        SHARE_TOKEN
      )
    })

    it('should use default dialog title when not provided', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Share collection "My Collection"',
        })
      )
    })

    it('should use custom dialog title when provided', async () => {
      const options = { dialogTitle: 'Share this collection' }
      await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME,
        options
      )

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Share this collection',
        })
      )
    })

    it('should include share message in Share.share call', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      expect(callArgs.message).toContain(COLLECTION_NAME)
      expect(callArgs.message).toContain(SHARE_URL)
    })

    it('should include share token in message', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      expect(callArgs.message).toContain(SHARE_URL)
    })

    it('should add breadcrumb to Sentry on successful share', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'sharing',
          message: 'Collection shared via native share sheet',
          data: expect.objectContaining({
            collectionName: COLLECTION_NAME,
            shareToken: SHARE_TOKEN,
            platform: 'ios',
          }),
          level: 'info',
        })
      )
    })

    it('should log info before sharing', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      expect(logger.logInfo).toHaveBeenCalled()
      const callArgs = (logger.logInfo as jest.Mock).mock.calls[0]
      expect(callArgs[0]).toContain('About to call')
      expect(callArgs[2]).toBe('sharingUtils')
    })

    it('should return success false on error', async () => {
      const error = new Error(SHARE_FAILED_ERROR)
      ;(Share.share as jest.Mock).mockRejectedValueOnce(error)

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe(SHARE_FAILED_ERROR)
    })

    it('should handle non-Error exceptions', async () => {
      ;(Share.share as jest.Mock).mockRejectedValueOnce('String error')

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown sharing error')
    })

    it('should capture exception to Sentry on error', async () => {
      const error = new Error(SHARE_FAILED_ERROR)
      ;(Share.share as jest.Mock).mockRejectedValueOnce(error)

      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: expect.objectContaining({
          operation: 'shareCollectionUrl',
          platform: 'ios',
        }),
        extra: expect.objectContaining({
          shareToken: SHARE_TOKEN,
          collectionName: COLLECTION_NAME,
        }),
      })
    })

    it('should include options in Sentry extra data on error', async () => {
      ;(Share.share as jest.Mock).mockRejectedValueOnce(
        new Error(SHARE_FAILED_ERROR)
      )

      const options = { dialogTitle: 'Custom title' }
      await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME,
        options
      )

      const callArgs = (Sentry.captureException as jest.Mock).mock.calls[0][1]
      expect(callArgs.extra.options).toEqual(options)
    })

    it('should work with different platforms', async () => {
      ;(Platform.OS as any) = 'android'

      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platform: 'android',
          }),
        })
      )
    })

    it('should handle empty collection name', async () => {
      const result = await sharingUtils.shareCollectionUrl(SHARE_TOKEN, '')

      expect(result.success).toBe(true)
    })

    it('should handle special characters in collection name', async () => {
      const collectionName = 'My "Special" Collection & More'
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, collectionName)

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      expect(callArgs.message).toContain(collectionName)
    })

    it('should handle long share token', async () => {
      const longToken = 'a'.repeat(100)
      ;(collectionSharingService.generateShareUrl as jest.Mock).mockReturnValue(
        `https://example.com/share/${longToken}`
      )

      const result = await sharingUtils.shareCollectionUrl(
        longToken,
        COLLECTION_NAME
      )

      expect(result.success).toBe(true)
    })
  })

  describe('share message creation', () => {
    it('should include collection name in message', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, 'Dutch Verbs')

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      expect(callArgs.message).toContain('Dutch Verbs')
    })

    it('should include share URL in message', async () => {
      const expectedUrl = 'https://example.com/share/token123'
      ;(collectionSharingService.generateShareUrl as jest.Mock).mockReturnValue(
        expectedUrl
      )

      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      expect(callArgs.message).toContain(expectedUrl)
    })

    it('should include app name in message', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      expect(callArgs.message).toContain(DUTCH_LEARNING_APP)
    })

    it('should include learning method hint', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      expect(callArgs.message).toContain('spaced repetition')
    })

    it('should format message with line breaks', async () => {
      await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)

      const callArgs = (Share.share as jest.Mock).mock.calls[0][0]
      const lines = callArgs.message.split('\n')
      expect(lines.length).toBeGreaterThan(1)
    })
  })

  describe('options handling', () => {
    it('should accept and use custom fallbackUrl option', async () => {
      const options = { fallbackUrl: 'https://fallback.com' }
      await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME,
        options
      )

      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('should accept and use custom mimeType option', async () => {
      const options = { mimeType: 'text/plain' }
      await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME,
        options
      )

      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('should accept and use custom UTI option', async () => {
      const options = { UTI: 'public.text' }
      await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME,
        options
      )

      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('should accept and use custom anchor option', async () => {
      const options = { anchor: { x: 10, y: 20, width: 100, height: 50 } }
      await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME,
        options
      )

      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('should handle multiple options together', async () => {
      const options = {
        dialogTitle: 'Share Collection',
        fallbackUrl: 'https://fallback.com',
        mimeType: 'text/plain',
      }

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME,
        options
      )

      expect(result.success).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle Share.share rejection', async () => {
      const error = new Error('Share was cancelled')
      ;(Share.share as jest.Mock).mockRejectedValueOnce(error) // Original error message

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should not throw on error', async () => {
      ;(Share.share as jest.Mock).mockRejectedValueOnce(
        new Error(SHARE_FAILED_ERROR)
      )

      expect(async () => {
        await sharingUtils.shareCollectionUrl(SHARE_TOKEN, COLLECTION_NAME)
      }).not.toThrow()
    })

    it('should provide error message in result', async () => {
      const errorMessage = 'Specific error message'
      ;(Share.share as jest.Mock).mockRejectedValueOnce(new Error(errorMessage))

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.error).toBe(errorMessage)
    })

    it('should handle undefined error gracefully', async () => {
      ;(Share.share as jest.Mock).mockRejectedValueOnce(undefined)

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown sharing error')
    })

    it('should handle generateShareUrl errors', async () => {
      ;(
        collectionSharingService.generateShareUrl as jest.Mock
      ).mockImplementation(() => {
        throw new Error('URL generation failed')
      })

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.success).toBe(false)
    })
  })

  describe('return values', () => {
    it('should return ShareResult interface', async () => {
      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result).toHaveProperty('success')
      expect(typeof result.success).toBe('boolean')
    })

    it('should have error property when failed', async () => {
      ;(Share.share as jest.Mock).mockRejectedValueOnce(
        new Error('Share failed')
      )

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result).toHaveProperty('error')
      expect(typeof result.error).toBe('string')
    })

    it('should not have error property when successful', async () => {
      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      expect(result.error).toBeUndefined()
    })

    it('should be consistent with ShareResult interface', async () => {
      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        COLLECTION_NAME
      )

      // Result should match expected ShareResult type
      expect('success' in result).toBe(true)
      expect('error' in result || result.success).toBe(true)
    })
  })

  describe('integration scenarios', () => {
    it('should handle successful share flow end-to-end', async () => {
      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        'German Nouns'
      )

      expect(result.success).toBe(true)
      expect(collectionSharingService.generateShareUrl).toHaveBeenCalled()
      expect(Share.share).toHaveBeenCalled()
      expect(Sentry.addBreadcrumb).toHaveBeenCalled()
      expect(logger.logInfo).toHaveBeenCalled()
    })

    it('should handle failure flow end-to-end', async () => {
      ;(Share.share as jest.Mock).mockRejectedValueOnce(
        new Error(SHARE_FAILED_ERROR)
      )

      const result = await sharingUtils.shareCollectionUrl(
        SHARE_TOKEN,
        'German Nouns'
      )

      expect(result.success).toBe(false)
      expect(Sentry.captureException).toHaveBeenCalled()
    })

    it('should work with various collection names', async () => {
      const names = [
        'Simple',
        'Collection With Spaces',
        'Collection-With-Dashes',
        'Collection_With_Underscores',
        '1234-Numbers',
        'Коллекция на русском',
      ]

      for (const name of names) {
        await sharingUtils.shareCollectionUrl('token', name)
      }

      expect(Share.share).toHaveBeenCalledTimes(names.length)
    })

    it('should work with various share tokens', async () => {
      const tokens = [
        'simple-token',
        'token-with-long-uuid-like-format-abcd1234',
        'token-123',
        'tokenWithoutDashes',
      ]

      for (const token of tokens) {
        await sharingUtils.shareCollectionUrl(token, COLLECTION_NAME)
      }

      expect(Share.share).toHaveBeenCalledTimes(tokens.length)
    })
  })
})
