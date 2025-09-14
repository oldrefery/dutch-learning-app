import React from 'react'
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Text } from '@/components/Themed'
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
        <ActivityIndicator
          color={
            variant === 'primary'
              ? Colors.background.primary
              : Colors.primary.DEFAULT
          }
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary'
              ? styles.primaryButtonText
              : styles.secondaryButtonText,
          ]}
        >
          {title}
        </Text>
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
  primaryButtonText: {
    color: Colors.background.primary,
  },
  secondaryButtonText: {
    color: Colors.primary.DEFAULT,
  },
})
