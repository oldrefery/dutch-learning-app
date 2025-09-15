import React, { useState } from 'react'
import {
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { useSimpleAuth } from '@/contexts/SimpleAuthProvider'
import { Colors } from '@/constants/Colors'
import { Sentry } from '@/lib/sentry'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const { testSignIn, loading, error, clearError } = useSimpleAuth()

  const handleEmailChange = (text: string) => {
    setEmail(text)
    if (emailError) setEmailError('')
    if (error) clearError()
  }

  const handlePasswordChange = (text: string) => {
    setPassword(text)
    if (passwordError) setPasswordError('')
    if (error) clearError()
  }

  const handleSignIn = async () => {
    // Clear previous errors
    setEmailError('')
    setPasswordError('')
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
      setPasswordError('Password must be at least 6 characters')
      hasError = true
    }

    if (hasError) {
      return
    }

    try {
      await testSignIn({ email: email.trim(), password })
    } catch (error) {
      // Error handled by SimpleAuthProvider
      Sentry.captureException(error)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
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
              <TextThemed style={styles.title}>Welcome Back</TextThemed>
              <TextThemed style={styles.subtitle}>
                Sign in to continue learning Dutch
              </TextThemed>
            </ViewThemed>

            <ViewThemed style={styles.form}>
              <AuthInput
                label="Email"
                value={email}
                onChangeText={handleEmailChange}
                error={emailError}
                placeholder="Enter your email"
                keyboardType="email-address"
              />

              <AuthInput
                label="Password"
                value={password}
                onChangeText={handlePasswordChange}
                error={passwordError}
                placeholder="Enter your password"
                isPassword
              />

              {error && (
                <ViewThemed style={styles.errorContainer}>
                  <TextThemed style={styles.errorText}>{error}</TextThemed>
                </ViewThemed>
              )}

              <AuthButton
                title="Sign In"
                onPress={handleSignIn}
                loading={loading}
              />
            </ViewThemed>

            <ViewThemed style={styles.footer}>
              <TextThemed style={styles.footerText}>
                Don&apos;t have an account?{' '}
                <Link href="/signup" asChild>
                  <TextThemed style={styles.linkText}>Sign up</TextThemed>
                </Link>
              </TextThemed>

              {__DEV__ && (
                <TouchableOpacity
                  style={styles.devButton}
                  onPress={() => {
                    setEmail('test@test.com')
                    setPassword('test')
                  }}
                >
                  <TextThemed style={styles.devButtonText}>
                    DEV: Fill Test Data
                  </TextThemed>
                </TouchableOpacity>
              )}
            </ViewThemed>
          </ViewThemed>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
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
    color: Colors.neutral[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: Colors.error.light,
    borderColor: Colors.error.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error.DEFAULT,
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  linkText: {
    color: Colors.primary.DEFAULT,
    fontWeight: '600',
  },
  devButton: {
    marginTop: 16,
    padding: 8,
    backgroundColor: Colors.warning.DEFAULT,
    borderRadius: 4,
    alignItems: 'center',
  },
  devButtonText: {
    color: Colors.background.primary,
    fontSize: 12,
    fontWeight: '600',
  },
})
