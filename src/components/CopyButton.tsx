import React from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { Colors } from '@/constants/Colors'
import { Sentry } from '@/lib/sentry'

interface CopyButtonProps {
  text: string
  size?: number
  color?: string
  onCopySuccess?: () => void
  showFeedback?: boolean
}

export function CopyButton({
  text,
  size = 18,
  color = Colors.neutral[500],
  onCopySuccess,
  showFeedback = true,
}: CopyButtonProps) {
  const handleCopy = async () => {
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
  }

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet'
      scheduleOnRN(handleCopy)
    })
    .blocksExternalGesture()

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={{ padding: 4 }}>
        <Ionicons name="copy-outline" size={size} color={color} />
      </View>
    </GestureDetector>
  )
}
