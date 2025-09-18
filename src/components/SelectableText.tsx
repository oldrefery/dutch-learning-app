import React, { useState } from 'react'
import { TouchableOpacity } from 'react-native'
import { TextThemed } from '@/components/Themed'
import * as Clipboard from 'expo-clipboard'
import Toast from 'react-native-toast-message'
import { Colors } from '@/constants/Colors'
import type { TextProps } from '@/components/Themed'

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
          Toast.show({
            type: 'success',
            text1: 'Copied!',
            text2: 'Text copied to clipboard',
            position: 'bottom',
            visibilityTime: 1500,
          })
        }
      }
    } catch (error) {
      console.error('Failed to copy text:', error)
      if (showCopyFeedback) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to copy text',
          position: 'bottom',
        })
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
        backgroundColor: isPressed ? Colors.primary.lightest : 'transparent',
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
