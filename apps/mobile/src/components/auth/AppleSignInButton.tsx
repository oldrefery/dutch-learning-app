import React from 'react'
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  View,
  Platform,
} from 'react-native'
import { AntDesign } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'

interface AppleSignInButtonProps {
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}

export function AppleSignInButton({
  onPress,
  loading = false,
  disabled = false,
}: AppleSignInButtonProps) {
  const isDisabled = loading || disabled
  const colorScheme = useColorScheme() ?? 'light'

  // Apple Sign-In only works on iOS
  if (Platform.OS !== 'ios') {
    return null
  }

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
          color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          <AntDesign
            name="apple"
            size={18}
            color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
            style={styles.icon}
          />
          <TextThemed
            style={styles.buttonText}
            lightColor="#000000"
            darkColor="#FFFFFF"
          >
            Sign in with Apple
          </TextThemed>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    flexDirection: 'row',
  },
  buttonLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  buttonDark: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
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
  icon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
})
