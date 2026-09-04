import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import { supabase } from './supabaseClient'
import { Sentry } from './sentry'

/**
 * Generate a secure random nonce for Apple Sign-In
 * This prevents replay attacks
 */
async function generateNonce(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32)
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Hash the nonce using SHA-256
 * Apple requires a hashed nonce for security
 */
async function hashNonce(nonce: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  )
}

/**
 * Check if Apple Sign-In is available on the device
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false
  }

  try {
    return await AppleAuthentication.isAvailableAsync()
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'appleAuthAvailabilityCheck' },
      extra: { message: 'Failed to check Apple Auth availability' },
    })
    return false
  }
}

/**
 * Initiate Apple Sign-In flow
 * Returns success/failure result
 */
export async function initiateAppleSignIn(): Promise<{
  type: 'success' | 'cancel' | 'error'
  error?: Error
}> {
  try {
    // Check availability first
    const isAvailable = await isAppleAuthAvailable()
    if (!isAvailable) {
      return {
        type: 'error',
        error: new Error('Apple Sign-In is not available on this device'),
      }
    }

    // Generate and hash nonce for security
    const nonce = await generateNonce()
    const hashedNonce = await hashNonce(nonce)

    // Request Apple credentials
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    })

    // Check for required tokens
    if (!credential.identityToken) {
      throw new Error('No identity token returned from Apple')
    }

    // Sign in with Supabase using Apple ID token
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: nonce,
    })

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'appleAuthSupabaseSignIn' },
        extra: { message: 'Failed to sign in with Supabase using Apple token' },
      })
      throw error
    }

    return { type: 'success' }
  } catch (error) {
    // Check if user cancelled
    if (
      error instanceof Error &&
      error.message.includes('ERR_REQUEST_CANCELED')
    ) {
      return { type: 'cancel' }
    }

    // Log other errors to Sentry
    Sentry.captureException(error, {
      tags: { operation: 'appleAuthInit' },
      extra: { message: 'Apple Sign-In failed' },
    })

    return {
      type: 'error',
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}
