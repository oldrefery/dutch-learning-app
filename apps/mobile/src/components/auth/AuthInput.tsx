import React, { useState, useRef } from 'react'
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  useColorScheme,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface AuthInputProps extends TextInputProps {
  label: string
  error?: string
  isPassword?: boolean
}

export function AuthInput({
  label,
  error,
  isPassword = false,
  style,
  ...props
}: AuthInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const colorScheme = useColorScheme() ?? 'light'
  const toggleTestId =
    isPassword && props.testID ? `${props.testID}-toggle` : undefined

  const inputBackgroundColor =
    colorScheme === 'dark'
      ? Colors.dark.backgroundSecondary
      : Colors.background.primary

  const borderColor = error
    ? Colors.error.DEFAULT
    : colorScheme === 'dark'
      ? Colors.neutral[600]
      : Colors.neutral[300]

  const textColor =
    colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[900]

  const placeholderColor =
    colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[500]

  const iconColor =
    colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[400]

  return (
    <ViewThemed style={styles.container}>
      <TextThemed
        style={styles.label}
        lightColor={Colors.neutral[700]}
        darkColor={Colors.dark.textSecondary}
      >
        {label}
      </TextThemed>
      <ViewThemed
        style={[
          styles.inputContainer,
          error && styles.inputContainerError,
          {
            backgroundColor: inputBackgroundColor,
            borderColor: borderColor,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: textColor }, style]}
          placeholderTextColor={placeholderColor}
          secureTextEntry={isPassword && !isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          testID={props.testID}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeIcon}
            activeOpacity={0.7}
            testID={toggleTestId}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </ViewThemed>
      {error ? <TextThemed style={styles.errorText}>{error}</TextThemed> : null}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputContainerError: {
    borderColor: Colors.error.DEFAULT,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error.DEFAULT,
    marginTop: 4,
  },
})
