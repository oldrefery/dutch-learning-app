import React from 'react'
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface AuthButtonProps {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: AuthButtonProps) {
  const isDisabled = loading || disabled
  const colorScheme = useColorScheme() ?? 'light'

  const primaryTextColor =
    colorScheme === 'dark' ? Colors.dark.background : Colors.background.primary

  const secondaryTextColor = Colors.primary.DEFAULT

  const activityIndicatorColor =
    variant === 'primary' ? primaryTextColor : secondaryTextColor

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        isDisabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={activityIndicatorColor} size="small" />
      ) : (
        <TextThemed
          style={[
            styles.buttonText,
            variant === 'primary'
              ? { color: primaryTextColor }
              : { color: secondaryTextColor },
          ]}
        >
          {title}
        </TextThemed>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButton: {
    backgroundColor: Colors.primary.DEFAULT,
    shadowColor: Colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary.DEFAULT,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
