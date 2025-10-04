import React, { useState } from 'react'
import {
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { useSimpleAuth } from '@/contexts/SimpleAuthProvider'
import { Colors } from '@/constants/Colors'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  const { requestPasswordReset, loading, error, clearError } = useSimpleAuth()

  const handleEmailChange = (text: string) => {
    setEmail(text)
    if (emailError) setEmailError('')
    if (error) clearError()
  }

  const handleResetRequest = async () => {
    // Clear previous errors
    setEmailError('')
    clearError()

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email.trim()) {
      setEmailError('Email is required')
      return
    }

    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address')
      return
    }

    await requestPasswordReset(email)
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
                  Reset Password
                </TextThemed>
                <TextThemed
                  style={styles.subtitle}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Enter your email address and we&apos;ll send you a link to
                  reset your password
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

                {error && (
                  <ViewThemed
                    style={[
                      styles.messageContainer,
                      {
                        backgroundColor: error.includes('sent')
                          ? Colors.success.light
                          : Colors.error.light,
                        borderColor: error.includes('sent')
                          ? Colors.success.border
                          : Colors.error.border,
                      },
                    ]}
                  >
                    <TextThemed
                      style={[
                        styles.messageText,
                        {
                          color: error.includes('sent')
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
                  title="Send Reset Link"
                  onPress={handleResetRequest}
                  loading={loading}
                />
              </ViewThemed>

              <ViewThemed style={styles.footer}>
                <TextThemed
                  style={styles.footerText}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Remember your password?{' '}
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
    lineHeight: 22,
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
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary.DEFAULT,
    fontWeight: '600',
  },
})
