import { Platform, Share } from 'react-native'
import { Sentry } from '@/lib/sentry'
import { collectionSharingService } from '@/services/collectionSharingService'
import { logInfo } from '@/utils/logger'

export interface ShareCollectionOptions {
  fallbackUrl?: string
  dialogTitle?: string
  mimeType?: string
  UTI?: string
  anchor?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ShareResult {
  success: boolean
  error?: string
}

class SharingUtils {
  async shareCollectionUrl(
    shareToken: string,
    collectionName: string,
    options: ShareCollectionOptions = {}
  ): Promise<ShareResult> {
    try {
      const deepLinkUrl = collectionSharingService.generateShareUrl(shareToken)
      const webShareUrl =
        options.fallbackUrl ||
        collectionSharingService.generateWebShareUrl(shareToken)

      const dialogTitle =
        options.dialogTitle || `Share collection "${collectionName}"`

      const shareMessage = this.createShareMessage(
        collectionName,
        deepLinkUrl,
        webShareUrl
      )

      logInfo(
        'About to call Share.share with message',
        {
          message: shareMessage,
          messageLength: shareMessage.length,
        },
        'sharingUtils'
      )

      // Use React Native's built-in Share API for text content
      await Share.share({
        message: shareMessage,
        title: dialogTitle,
      })

      Sentry.addBreadcrumb({
        category: 'sharing',
        message: 'Collection shared via native share sheet',
        data: {
          collectionName,
          shareToken,
          platform: Platform.OS,
        },
        level: 'info',
      })

      return { success: true }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'shareCollectionUrl',
          platform: Platform.OS,
        },
        extra: {
          shareToken,
          collectionName,
          options,
        },
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sharing error',
      }
    }
  }

  private createShareMessage(
    collectionName: string,
    deepLinkUrl: string,
    webShareUrl: string
  ): string {
    const appName = 'Dutch Learning App'

    return `Check out "${collectionName}" collection in ${appName}!\n\nOpen in app:\n${deepLinkUrl}\n\nOr open in browser:\n${webShareUrl}\n\nGreat for learning Dutch vocabulary with spaced repetition!`
  }
}

export const sharingUtils = new SharingUtils()
