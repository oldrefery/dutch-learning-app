import React from 'react'
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  View,
} from 'react-native'
import { AntDesign } from '@expo/vector-icons'
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
          <AntDesign
            name="google"
            size={18}
            color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
            style={styles.icon}
          />
          <TextThemed
            style={styles.buttonText}
            lightColor="#1f1f1f"
            darkColor="#e3e3e3"
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
    borderColor: '#dadce0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  buttonDark: {
    backgroundColor: '#131314',
    borderColor: '#8e918f',
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
    fontWeight: '500',
    letterSpacing: 0.25,
  },
})
