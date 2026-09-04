import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../supabaseClient'
import { handleOAuthCallback, initiateGoogleOAuth } from '../googleAuth'

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
