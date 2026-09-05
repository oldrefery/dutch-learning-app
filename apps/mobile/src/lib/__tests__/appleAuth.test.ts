import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import { initiateAppleSignIn, isAppleAuthAvailable } from '../appleAuth'
import { supabase } from '../supabaseClient'
import { Sentry } from '../sentry'

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}))
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}))
jest.mock('../supabaseClient', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn() } },
}))
jest.mock('../sentry', () => ({
  Sentry: { captureException: jest.fn() },
}))

describe('Apple sign-in', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.replaceProperty(Platform, 'OS', 'ios')
    ;(AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true)
    ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'apple-id-token',
    })
    ;(Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(
      new Uint8Array([1, 255])
    )
    ;(Crypto.digestStringAsync as jest.Mock).mockResolvedValue('hashed-nonce')
    ;(supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
      error: null,
    })
  })

  afterEach(() => jest.restoreAllMocks())

  it('uses a hashed nonce with Apple and the original nonce with Supabase', async () => {
    await expect(initiateAppleSignIn()).resolves.toEqual({ type: 'success' })
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32)
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', '01ff')
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: 'hashed-nonce',
    })
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: '01ff',
    })
  })

  it('does not request Apple credentials on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    await expect(initiateAppleSignIn()).resolves.toEqual({
      type: 'error',
      error: new Error('Apple Sign-In is not available on this device'),
    })
    expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled()
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled()
  })

  it('reports availability check failures without throwing', async () => {
    const error = new Error('Availability check failed')
    ;(AppleAuthentication.isAvailableAsync as jest.Mock).mockRejectedValue(
      error
    )
    await expect(isAppleAuthAvailable()).resolves.toBe(false)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: { operation: 'appleAuthAvailabilityCheck' },
      })
    )
  })

  it('returns an error for a missing identity token', async () => {
    ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: null,
    })
    await expect(initiateAppleSignIn()).resolves.toEqual({
      type: 'error',
      error: new Error('No identity token returned from Apple'),
    })
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('reports Supabase errors and preserves the original error', async () => {
    const error = new Error('Token rejected')
    ;(supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({ error })
    await expect(initiateAppleSignIn()).resolves.toEqual({
      type: 'error',
      error,
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: { operation: 'appleAuthSupabaseSignIn' },
      })
    )
  })

  it('treats user cancellation as a non-error result', async () => {
    ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(
      Object.assign(new Error('The user canceled the authorization attempt'), {
        code: 'ERR_REQUEST_CANCELED',
      })
    )
    await expect(initiateAppleSignIn()).resolves.toEqual({ type: 'cancel' })
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('recognizes cancellation codes on native rejection objects', async () => {
    ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({
      code: 'ERR_REQUEST_CANCELED',
      message: 'Authorization canceled',
    })

    await expect(initiateAppleSignIn()).resolves.toEqual({ type: 'cancel' })
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('does not confuse an unrelated error message with cancellation', async () => {
    const error = Object.assign(new Error('Unexpected ERR_REQUEST_CANCELED'), {
      code: 'ERR_REQUEST_FAILED',
    })
    ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(error)

    await expect(initiateAppleSignIn()).resolves.toEqual({
      type: 'error',
      error,
    })
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('handles a null rejection without throwing from error classification', async () => {
    ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(null)

    await expect(initiateAppleSignIn()).resolves.toEqual({
      type: 'error',
      error: new Error('Unknown error'),
    })
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled()
  })

  it('normalizes unexpected non-Error rejections', async () => {
    ;(Crypto.getRandomBytesAsync as jest.Mock).mockRejectedValue('unavailable')
    await expect(initiateAppleSignIn()).resolves.toEqual({
      type: 'error',
      error: new Error('Unknown error'),
    })
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled()
  })
})
