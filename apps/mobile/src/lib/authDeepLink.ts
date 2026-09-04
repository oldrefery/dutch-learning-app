export interface AuthCallbackTokens {
  accessToken: string
  refreshToken: string
}

export type AuthDeepLink =
  | {
      kind: 'password-recovery'
      tokens: AuthCallbackTokens
    }
  | {
      kind: 'primary-session'
      tokens: AuthCallbackTokens
    }
  | {
      kind: 'invalid-auth-callback'
      reason: 'missing-tokens' | 'provider-error' | 'unsupported-type'
    }
  | {
      kind: 'not-auth-callback'
    }

const PRIMARY_SESSION_TYPES = new Set([
  'email',
  'email_change',
  'invite',
  'magiclink',
  'signup',
])
type InvalidAuthCallbackReason =
  'missing-tokens' | 'provider-error' | 'unsupported-type'

const invalidAuthCallback = (
  reason: InvalidAuthCallbackReason
): AuthDeepLink => ({
  kind: 'invalid-auth-callback',
  reason,
})

const getCallbackParams = (url: string): URLSearchParams => {
  const [urlBeforeFragment, fragment = ''] = url.split('#', 2)
  const queryStart = urlBeforeFragment.indexOf('?')
  const query =
    queryStart >= 0 ? urlBeforeFragment.slice(queryStart + 1) : undefined
  const params = new URLSearchParams(query)

  new URLSearchParams(fragment).forEach((value, key) => {
    params.set(key, value)
  })

  return params
}

const targetsPasswordResetRoute = (url: string): boolean =>
  url.split(/[?#]/, 1)[0].toLowerCase().includes('reset-password')

export const parseAuthDeepLink = (url: string): AuthDeepLink => {
  const params = getCallbackParams(url)
  const callbackType = params.get('type')?.toLowerCase()
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const hasAuthParameters = Boolean(
    callbackType ||
    accessToken ||
    refreshToken ||
    params.get('error') ||
    params.get('error_code')
  )

  if (!hasAuthParameters) {
    return { kind: 'not-auth-callback' }
  }

  if (params.get('error') || params.get('error_code')) {
    return invalidAuthCallback('provider-error')
  }

  if (!accessToken || !refreshToken) {
    return invalidAuthCallback('missing-tokens')
  }

  const tokens = { accessToken, refreshToken }
  if (callbackType === 'recovery' || targetsPasswordResetRoute(url)) {
    return {
      kind: 'password-recovery',
      tokens,
    }
  }

  if (!callbackType || PRIMARY_SESSION_TYPES.has(callbackType)) {
    return {
      kind: 'primary-session',
      tokens,
    }
  }

  return invalidAuthCallback('unsupported-type')
}
