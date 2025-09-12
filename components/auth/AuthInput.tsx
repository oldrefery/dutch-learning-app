import React, { useState, useRef } from 'react'
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/Themed'
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[styles.inputContainer, error && styles.inputContainerError]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, style]}
          secureTextEntry={isPassword && !isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeIcon}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={Colors.neutral[400]}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    backgroundColor: Colors.background.primary,
  },
  inputContainerError: {
    borderColor: Colors.error.DEFAULT,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[900],
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
