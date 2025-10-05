import React from 'react'
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  View,
} from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface GoogleSignInButtonProps {
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}

export function GoogleSignInButton({
  onPress,
  loading = false,
  disabled = false,
}: GoogleSignInButtonProps) {
  const isDisabled = loading || disabled
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <TouchableOpacity
      style={[
        styles.button,
        colorScheme === 'dark' ? styles.buttonDark : styles.buttonLight,
        isDisabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={
            colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[900]
          }
          size="small"
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <TextThemed style={styles.googleIcon}>G</TextThemed>
          </View>
          <TextThemed
            style={styles.buttonText}
            lightColor={Colors.neutral[900]}
            darkColor={Colors.dark.text}
          >
            Continue with Google
          </TextThemed>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 1,
    flexDirection: 'row',
  },
  buttonLight: {
    backgroundColor: Colors.background.primary,
    borderColor: Colors.neutral[300],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonDark: {
    backgroundColor: Colors.dark.cardBackground,
    borderColor: Colors.neutral[700],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 20,
    height: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
