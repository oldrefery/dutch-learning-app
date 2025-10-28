import React, { useState } from 'react'
import {
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native'
import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { AppleSignInButton } from '@/components/auth/AppleSignInButton'
import { useSimpleAuth } from '@/contexts/SimpleAuthProvider'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import { Sentry } from '@/lib/sentry'

export default function SignupScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')

  const {
    testSignUp,
    signInWithGoogle,
    signInWithApple,
    loading,
    error,
    clearError,
  } = useSimpleAuth()

  const handleEmailChange = (text: string) => {
    setEmail(text)
    if (emailError) setEmailError('')
    if (error) clearError()
  }

  const handlePasswordChange = (text: string) => {
    setPassword(text)
    if (passwordError) setPasswordError('')
    if (confirmPasswordError && text === confirmPassword) {
      setConfirmPasswordError('')
    }
    if (error) clearError()
  }

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text)
    if (confirmPasswordError) setConfirmPasswordError('')
    if (error) clearError()
  }

  const handleSignUp = async () => {
    // Clear previous errors
    setEmailError('')
    setPasswordError('')
    setConfirmPasswordError('')
    clearError()

    // Validation
    let hasError = false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email.trim()) {
      setEmailError('Email is required')
      hasError = true
    } else if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address')
      hasError = true
    }

    if (!password) {
      setPasswordError('Password is required')
      hasError = true
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      hasError = true
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password')
      hasError = true
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match')
      hasError = true
    }

    if (hasError) return

    try {
      await testSignUp({
        email: email.trim(),
        password,
        confirmPassword,
      })

      router.push(ROUTES.AUTH.LOGIN)
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'signup' },
        extra: { message: 'Signup failed' },
      })
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      // Error handled by SimpleAuthProvider
      Sentry.captureException(error)
    }
  }

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple()
    } catch (error) {
      // Error handled by SimpleAuthProvider
      Sentry.captureException(error)
    }
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
                  Create Account
                </TextThemed>
                <TextThemed
                  style={styles.subtitle}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Join us to start your Dutch learning journey
                </TextThemed>
              </ViewThemed>

              <ViewThemed style={styles.form}>
                <AppleSignInButton
                  onPress={handleAppleSignIn}
                  loading={loading}
                />

                <GoogleSignInButton
                  onPress={handleGoogleSignIn}
                  loading={loading}
                />

                <ViewThemed style={styles.dividerContainer}>
                  <ViewThemed
                    style={styles.divider}
                    lightColor={Colors.neutral[300]}
                    darkColor={Colors.neutral[700]}
                  />
                  <TextThemed
                    style={styles.dividerText}
                    lightColor={Colors.neutral[500]}
                    darkColor={Colors.neutral[500]}
                  >
                    OR
                  </TextThemed>
                  <ViewThemed
                    style={styles.divider}
                    lightColor={Colors.neutral[300]}
                    darkColor={Colors.neutral[700]}
                  />
                </ViewThemed>

                <AuthInput
                  label="Email"
                  value={email}
                  onChangeText={handleEmailChange}
                  error={emailError}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  testID="signup-email-input"
                />

                <AuthInput
                  label="Password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  error={passwordError}
                  placeholder="Create a password"
                  isPassword
                  testID="signup-password-input"
                />

                <AuthInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  error={confirmPasswordError}
                  placeholder="Confirm your password"
                  isPassword
                  testID="signup-confirm-password-input"
                />

                <ViewThemed style={styles.passwordRequirements}>
                  <TextThemed
                    style={styles.requirementsTitle}
                    lightColor={Colors.neutral[700]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    Password requirements:
                  </TextThemed>
                  <TextThemed
                    style={styles.requirementText}
                    lightColor={Colors.neutral[600]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    • At least 6 characters long
                  </TextThemed>
                  <TextThemed
                    style={styles.requirementText}
                    lightColor={Colors.neutral[600]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    • Contains at least one letter and one number
                  </TextThemed>
                </ViewThemed>

                {error && (
                  <ViewThemed
                    style={[
                      styles.messageContainer,
                      error.includes('Registration successful')
                        ? styles.successContainer
                        : error.includes('check your email') ||
                            error.includes('confirmation link')
                          ? styles.warningContainer
                          : styles.errorContainer,
                    ]}
                  >
                    <TextThemed
                      style={[
                        styles.messageText,
                        error.includes('Registration successful')
                          ? styles.successText
                          : error.includes('check your email') ||
                              error.includes('confirmation link')
                            ? styles.warningText
                            : styles.errorText,
                      ]}
                    >
                      {error}
                    </TextThemed>
                  </ViewThemed>
                )}

                <AuthButton
                  title="Create Account"
                  onPress={handleSignUp}
                  loading={loading}
                  testID="signup-button"
                />
              </ViewThemed>

              <ViewThemed style={styles.footer}>
                <TextThemed
                  style={styles.footerText}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Already have an account?{' '}
                  <Link href="/login" asChild>
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  passwordRequirements: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    lineHeight: 16,
  },
  messageContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorContainer: {
    backgroundColor: Colors.error.light,
    borderColor: Colors.error.border,
  },
  successContainer: {
    backgroundColor: Colors.success.light,
    borderColor: Colors.success.DEFAULT,
  },
  warningContainer: {
    backgroundColor: Colors.warning.light,
    borderColor: Colors.warning.DEFAULT,
  },
  messageText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.error.DEFAULT,
  },
  successText: {
    color: Colors.success.DEFAULT,
  },
  warningText: {
    color: Colors.warning.darkTheme,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary.DEFAULT,
    fontWeight: '600',
  },
})
