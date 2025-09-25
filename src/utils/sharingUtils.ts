import { Platform, Share } from 'react-native'
import { Sentry } from '@/lib/sentry'
import { collectionSharingService } from '@/services/collectionSharingService'

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
        collectionSharingService.generateWebShareUrl(shareToken)

      const dialogTitle =
        options.dialogTitle || `Share collection "${collectionName}"`

      const shareMessage = this.createShareMessage(
        collectionName,
        deepLinkUrl,
        webShareUrl
      )

      console.log(
        '🔄 [sharingUtils] About to call Share.share with message:',
        shareMessage
      )
      console.log('🔄 [sharingUtils] Message length:', shareMessage.length)

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

    return `Check out "${collectionName}" collection in ${appName}!\n\nOpen in app: ${deepLinkUrl}\n\nView in browser: ${webShareUrl}\n\nGreat for learning Dutch vocabulary with spaced repetition!`
  }

  async canShare(): Promise<boolean> {
    // React Native Share API is always available on mobile platforms
    return Platform.OS === 'ios' || Platform.OS === 'android'
  }

  getShareUrl(shareToken: string): string {
    return collectionSharingService.generateShareUrl(shareToken)
  }

  getWebShareUrl(shareToken: string): string {
    return collectionSharingService.generateWebShareUrl(shareToken)
  }

  private getPlatformSpecificShareOptions(
    options: ShareCollectionOptions = {}
  ): object {
    // Remove platform-specific options until we fix the sharing issue
    return {}
  }
}

export const sharingUtils = new SharingUtils()

export default sharingUtils
