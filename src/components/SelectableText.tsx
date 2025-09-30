import React, { useState } from 'react'
import { TouchableOpacity } from 'react-native'
import { TextThemed } from '@/components/Themed'
import * as Clipboard from 'expo-clipboard'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { Colors } from '@/constants/Colors'
import type { TextProps } from '@/components/Themed'
import { Sentry } from '@/lib/sentry.ts'

interface SelectableTextProps extends TextProps {
  copyText?: string // Текст для копирования, если отличается от отображаемого
  showCopyFeedback?: boolean
  children: React.ReactNode
}

export function SelectableText({
  copyText,
  showCopyFeedback = true,
  children,
  style,
  ...textProps
}: SelectableTextProps) {
  const [isPressed, setIsPressed] = useState(false)

  const handleLongPress = async () => {
    try {
      const textToCopy =
        copyText || (typeof children === 'string' ? children : '')
      if (textToCopy) {
        await Clipboard.setStringAsync(textToCopy)
        if (showCopyFeedback) {
          ToastService.show('Text copied to clipboard', ToastType.SUCCESS)
        }
      }
    } catch (error) {
      Sentry.captureException('Failed to copy text:', error)
      if (showCopyFeedback) {
        ToastService.show('Failed to copy text', ToastType.ERROR)
      }
    }
  }

  const handlePressIn = () => setIsPressed(true)
  const handlePressOut = () => setIsPressed(false)

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
      style={{
        backgroundColor: isPressed
          ? Colors.primary.light
          : Colors.legacy.transparent,
        borderRadius: 4,
        padding: 2,
        margin: -2,
      }}
    >
      <TextThemed style={style} selectable {...textProps}>
        {children}
      </TextThemed>
    </TouchableOpacity>
  )
}
