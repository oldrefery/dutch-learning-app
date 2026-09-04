import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../supabaseClient'
import {
  createSessionFromOAuthUrl,
  handleOAuthCallback,
  initiateGoogleOAuth,
} from '../googleAuth'
import { Sentry } from '../sentry'

jest.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
      signInWithOAuth: jest.fn(),
    },
  },
}))

jest.mock('../sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
  },
}))

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}))

const oauthCallbackUrl =
  'dutchlearning://#access_token=oauth-access&refresh_token=oauth-refresh'
const recoveryCallbackUrl =
  'dutchlearning://reset-password#access_token=recovery-access&refresh_token=recovery-refresh&type=recovery'

describe('Google auth callbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(WebBrowser.openAuthSessionAsync as jest.Mock)
      .mockReset()
      .mockResolvedValue({ type: 'cancel' })
    ;(supabase.auth.setSession as jest.Mock).mockResolvedValue({ error: null })
    ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
      data: { url: 'https://example.supabase.co/oauth' },
      error: null,
    })
  })

  it('does not create a primary session from a recovery callback', async () => {
    await expect(handleOAuthCallback(recoveryCallbackUrl)).resolves.toBe(false)

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('rejects recovery URLs when directly creating a primary session', async () => {
    await expect(
      createSessionFromOAuthUrl(recoveryCallbackUrl)
    ).rejects.toThrow('URL is not a primary auth session callback')
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('reports initialization errors and releases callback ownership', async () => {
    const error = new Error('OAuth provider unavailable')
    ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
      data: null,
      error,
    })

    await expect(initiateGoogleOAuth()).rejects.toBe(error)
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ tags: { operation: 'googleOAuthInit' } })
    )
    await expect(handleOAuthCallback(oauthCallbackUrl)).resolves.toBe(true)
  })

  it('rejects a missing provider URL without opening the browser', async () => {
    ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
      data: {},
      error: null,
    })

    await expect(initiateGoogleOAuth()).rejects.toThrow(
      'No OAuth URL returned from Supabase'
    )
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
  })

  it('returns cancellation without creating a session', async () => {
    await expect(initiateGoogleOAuth()).resolves.toEqual({ type: 'cancel' })
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    await expect(handleOAuthCallback(oauthCallbackUrl)).resolves.toBe(true)
  })

  it('reports and propagates session persistence failures', async () => {
    const error = new Error('Session write failed')
    ;(supabase.auth.setSession as jest.Mock).mockResolvedValue({ error })

    await expect(createSessionFromOAuthUrl(oauthCallbackUrl)).rejects.toBe(
      error
    )
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ tags: { operation: 'googleOAuthSetSession' } })
    )
    await expect(handleOAuthCallback(oauthCallbackUrl)).resolves.toBe(false)
  })

  it('creates a primary session from an OAuth callback', async () => {
    await expect(handleOAuthCallback(oauthCallbackUrl)).resolves.toBe(true)

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'oauth-access',
      refresh_token: 'oauth-refresh',
    })
  })

  it('lets the active browser flow own its callback', async () => {
    let resolveBrowser:
      ((result: WebBrowser.WebBrowserRedirectResult) => void) | undefined
    ;(WebBrowser.openAuthSessionAsync as jest.Mock).mockReturnValue(
      new Promise<WebBrowser.WebBrowserRedirectResult>(resolve => {
        resolveBrowser = resolve
      })
    )

    const oauthPromise = initiateGoogleOAuth()

    await expect(handleOAuthCallback(oauthCallbackUrl)).resolves.toBe(false)
    expect(supabase.auth.setSession).not.toHaveBeenCalled()

    resolveBrowser?.({ type: 'success', url: oauthCallbackUrl })
    await expect(oauthPromise).resolves.toEqual({
      type: 'success',
      url: oauthCallbackUrl,
    })
    expect(supabase.auth.setSession).toHaveBeenCalledTimes(1)
  })
})
