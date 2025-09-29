import React from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface FloatingActionButtonProps {
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  label?: string
  style?: ViewStyle
}

export function FloatingActionButton({
  onPress,
  disabled = false,
  loading = false,
  icon = 'checkmark',
  label,
  style,
}: FloatingActionButtonProps) {
  const colorScheme = useColorScheme() ?? 'light'

  const fabStyle: ViewStyle = {
    position: 'absolute',
    bottom: 100, // Above tab bar (80) + extra space
    right: 16,
    backgroundColor: disabled
      ? Colors.neutral[300]
      : colorScheme === 'dark'
        ? Colors.dark.tint
        : Colors.success.DEFAULT,
    borderRadius: label ? 28 : 28, // Circular for icon-only, rounded for with label
    paddingHorizontal: label ? 20 : 0,
    paddingVertical: label ? 12 : 0,
    width: label ? undefined : 56,
    height: label ? undefined : 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    opacity: disabled ? 0.6 : 1,
    ...style,
  }

  const textStyle: TextStyle = {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: label ? 8 : 0,
  }

  return (
    <TouchableOpacity
      style={fabStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <>
          <Ionicons name={icon} size={24} color="white" />
          {label && <TextThemed style={textStyle}>{label}</TextThemed>}
        </>
      )}
    </TouchableOpacity>
  )
}
