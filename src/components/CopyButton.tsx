import React, { useCallback } from 'react'
import * as Clipboard from 'expo-clipboard'
import { GlassIconButton } from '@/components/glass/buttons/GlassIconButton'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { Sentry } from '@/lib/sentry'

interface CopyButtonProps {
  text: string
  /** @deprecated Use variant instead */
  size?: number
  /** @deprecated Use variant instead */
  color?: string
  onCopySuccess?: () => void
  showFeedback?: boolean
  /** Button variant following HIG */
  variant?: 'tinted' | 'plain' | 'subtle'
  /** Button size with a proper tap target */
  buttonSize?: 'small' | 'medium' | 'large'
}

/**
 * Copy Button Component
 *
 * Now uses GlassIconButton for HIG compliance:
 * - 44x44pt minimum tap target
 * - Clear visual states
 * - Accessibility support
 */
export function CopyButton({
  text,
  onCopySuccess,
  showFeedback = true,
  variant = 'tinted',
  buttonSize = 'medium',
}: CopyButtonProps) {
  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(text)
      if (showFeedback) {
        ToastService.show(
          'Word information copied to clipboard',
          ToastType.SUCCESS
        )
      }
      onCopySuccess?.()
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'copyButtonCopy' },
        extra: { message: 'Failed to copy text' },
      })
      if (showFeedback) {
        ToastService.show('Failed to copy text', ToastType.ERROR)
      }
    }
  }, [text, showFeedback, onCopySuccess])

  return (
    <GlassIconButton
      icon="copy-outline"
      onPress={handleCopy}
      variant={variant}
      size={buttonSize}
      accessibilityLabel="Copy word information"
      accessibilityHint="Copies word details to clipboard"
    />
  )
}
