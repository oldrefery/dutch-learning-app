import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabaseClient'
import { Sentry } from './sentry'
import { parseAuthDeepLink } from './authDeepLink'

WebBrowser.maybeCompleteAuthSession()

let oauthFlowInProgress = false

export async function initiateGoogleOAuth(): Promise<WebBrowser.WebBrowserAuthSessionResult> {
  const redirectTo = 'dutchlearning://'
  oauthFlowInProgress = true

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      throw error
    }

    if (!data?.url) {
      throw new Error('No OAuth URL returned from Supabase')
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type === 'success' && result.url) {
      await createSessionFromOAuthUrl(result.url)
    }

    return result
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'googleOAuthInit' },
      extra: { message: 'Google OAuth initialization failed' },
    })
    throw error
  } finally {
    oauthFlowInProgress = false
  }
}

export async function createSessionFromOAuthUrl(url: string): Promise<void> {
  try {
    const callback = parseAuthDeepLink(url)
    if (callback.kind !== 'primary-session') {
      throw new Error('URL is not a primary auth session callback')
    }

    const { error } = await supabase.auth.setSession({
      access_token: callback.tokens.accessToken,
      refresh_token: callback.tokens.refreshToken,
    })

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'googleOAuthSetSession' },
        extra: { message: 'Failed to set session from OAuth tokens' },
      })
      throw error
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'googleOAuthCreateSession' },
      extra: { message: 'Failed to create session from OAuth URL', url },
    })
    throw error
  }
}

export async function handleOAuthCallback(url: string): Promise<boolean> {
  try {
    if (oauthFlowInProgress) {
      return false
    }

    const callback = parseAuthDeepLink(url)
    if (callback.kind !== 'primary-session') {
      return false
    }

    await createSessionFromOAuthUrl(url)
    return true
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'googleOAuthCallback' },
      extra: { message: 'Failed to handle OAuth callback', url },
    })
    return false
  }
}
