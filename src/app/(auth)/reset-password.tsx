import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import * as Linking from 'expo-linking'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { useSimpleAuth } from '@/contexts/SimpleAuthProvider'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'

export default function ResetPasswordScreen() {
  const searchParams = useLocalSearchParams<{
    access_token?: string
    refresh_token?: string
  }>()

  const [access_token, setAccessToken] = useState<string | undefined>(
    searchParams.access_token
  )
  const [refresh_token, setRefreshToken] = useState<string | undefined>(
    searchParams.refresh_token
  )

  // Parse hash fragment from deep link (Supabase sends tokens in hash)
  useEffect(() => {
    const parseUrlHash = async () => {
      const url = await Linking.getInitialURL()
      console.log('[ResetPassword] Initial URL:', url)

      if (url) {
        const hashPart = url.split('#')[1]
        console.log('[ResetPassword] Hash part:', hashPart)

        if (hashPart) {
          const params = new URLSearchParams(hashPart)
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          console.log('[ResetPassword] Tokens found:', {
            accessToken: accessToken ? 'yes' : 'no',
            refreshToken: refreshToken ? 'yes' : 'no',
          })

          if (accessToken && refreshToken) {
            setAccessToken(accessToken)
            setRefreshToken(refreshToken)
          }
        }
      }
    }

    parseUrlHash()
  }, [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')

  const { resetPassword, loading, error, clearError } = useSimpleAuth()

  const handlePasswordChange = (text: string) => {
    setPassword(text)
    if (passwordError) setPasswordError('')
    if (error) clearError()
  }

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text)
    if (confirmPasswordError) setConfirmPasswordError('')
    if (error) clearError()
  }

  const handleResetPassword = async () => {
    // Clear previous errors
    setPasswordError('')
    setConfirmPasswordError('')
    clearError()

    // Validation
    let hasError = false

    if (!password) {
      setPasswordError('Password is required')
      hasError = true
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      hasError = true
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password')
      hasError = true
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match')
      hasError = true
    }

    if (hasError) {
      return
    }

    await resetPassword(password, access_token, refresh_token)
  }

  return (
    <ViewThemed style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ViewThemed style={styles.content}>
              <ViewThemed style={styles.header}>
                <TextThemed
                  style={styles.title}
                  lightColor={Colors.neutral[900]}
                  darkColor={Colors.dark.text}
                >
                  Create New Password
                </TextThemed>
                <TextThemed
                  style={styles.subtitle}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Please enter your new password
                </TextThemed>
              </ViewThemed>

              <ViewThemed style={styles.form}>
                <AuthInput
                  label="New Password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  error={passwordError}
                  placeholder="Enter new password"
                  isPassword
                  testID="reset-password-input"
                />

                <AuthInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  error={confirmPasswordError}
                  placeholder="Confirm new password"
                  isPassword
                  testID="reset-confirm-password-input"
                />

                {error && (
                  <ViewThemed
                    style={[
                      styles.messageContainer,
                      {
                        backgroundColor: error.includes('successfully')
                          ? Colors.success.light
                          : Colors.error.light,
                        borderColor: error.includes('successfully')
                          ? Colors.success.border
                          : Colors.error.border,
                      },
                    ]}
                  >
                    <TextThemed
                      style={[
                        styles.messageText,
                        {
                          color: error.includes('successfully')
                            ? Colors.success.DEFAULT
                            : Colors.error.DEFAULT,
                        },
                      ]}
                    >
                      {error}
                    </TextThemed>
                  </ViewThemed>
                )}

                <AuthButton
                  title="Reset Password"
                  onPress={handleResetPassword}
                  loading={loading}
                  testID="reset-password-button"
                />
              </ViewThemed>

              <ViewThemed style={styles.footer}>
                <TextThemed
                  style={styles.footerText}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Remember your password?{' '}
                  <Link href={ROUTES.AUTH.LOGIN} asChild>
                    <TextThemed style={styles.linkText}>Sign in</TextThemed>
                  </Link>
                </TextThemed>
              </ViewThemed>
            </ViewThemed>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  content: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  messageContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary.DEFAULT,
    fontWeight: '600',
  },
})
