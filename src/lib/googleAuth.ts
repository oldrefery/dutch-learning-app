import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabaseClient'
import { Sentry } from './sentry'

// Warm up the browser for better UX
WebBrowser.maybeCompleteAuthSession()

/**
 * Extract access_token and refresh_token from OAuth redirect URL
 */
function extractTokensFromUrl(url: string): {
  access_token?: string
  refresh_token?: string
} {
  const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1])
  return {
    access_token: params.get('access_token') || undefined,
    refresh_token: params.get('refresh_token') || undefined,
  }
}

/**
 * Initialize Google OAuth flow
 * Returns the OAuth session result and session creation function
 */
export async function initiateGoogleOAuth(): Promise<{
  type: 'success' | 'cancel' | 'dismiss' | 'locked'
  url?: string
}> {
  try {
    // Create redirect URI using the app scheme from app.json
    const redirectTo = 'dutchlearning://auth/callback'

    // Start OAuth flow with Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'googleOAuthInit' },
        extra: { message: 'Failed to initialize Google OAuth' },
      })
      throw error
    }

    if (!data?.url) {
      throw new Error('No OAuth URL returned from Supabase')
    }

    // Open OAuth URL in browser
    return await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'googleOAuthInit' },
      extra: { message: 'Google OAuth initialization failed' },
    })
    throw error
  }
}

/**
 * Create Supabase session from OAuth callback URL
 */
export async function createSessionFromOAuthUrl(url: string): Promise<void> {
  try {
    const { access_token, refresh_token } = extractTokensFromUrl(url)

    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens in OAuth callback URL')
    }

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
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

/**
 * Handle OAuth callback deep link
 * Should be called when app receives a deep link during OAuth flow
 */
export async function handleOAuthCallback(url: string): Promise<boolean> {
  try {
    // Check if this is an OAuth callback URL
    if (!url.includes('auth/callback') && !url.includes('access_token')) {
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
