import { parseAuthDeepLink } from '../authDeepLink'

const ACCESS_TOKEN = 'access-secret'
const REFRESH_TOKEN = 'refresh-secret'
const AUTH_FRAGMENT = `access_token=${ACCESS_TOKEN}&refresh_token=${REFRESH_TOKEN}`
const TOKENS = {
  accessToken: ACCESS_TOKEN,
  refreshToken: REFRESH_TOKEN,
}
const INVALID_AUTH_CALLBACK = 'invalid-auth-callback'

describe('parseAuthDeepLink', () => {
  it('classifies a Supabase recovery callback', () => {
    expect(
      parseAuthDeepLink(
        `dutchlearning://reset-password#${AUTH_FRAGMENT}&type=recovery`
      )
    ).toEqual({
      kind: 'password-recovery',
      tokens: TOKENS,
    })
  })

  it('treats the reset-password route as recovery when type is omitted', () => {
    expect(
      parseAuthDeepLink(`dutchlearning://reset-password?${AUTH_FRAGMENT}`)
    ).toEqual({
      kind: 'password-recovery',
      tokens: TOKENS,
    })
  })

  it('classifies an OAuth callback as a primary session', () => {
    expect(parseAuthDeepLink(`dutchlearning://#${AUTH_FRAGMENT}`)).toEqual({
      kind: 'primary-session',
      tokens: TOKENS,
    })
  })

  it('preserves supported email session callbacks', () => {
    expect(
      parseAuthDeepLink(`dutchlearning://#${AUTH_FRAGMENT}&type=signup`)
    ).toEqual({
      kind: 'primary-session',
      tokens: TOKENS,
    })
  })

  it.each([
    'dutchlearning://#access_token=access-secret&type=recovery',
    'dutchlearning://#refresh_token=refresh-secret&type=recovery',
  ])('rejects an incomplete auth callback: %s', url => {
    expect(parseAuthDeepLink(url)).toEqual({
      kind: INVALID_AUTH_CALLBACK,
      reason: 'missing-tokens',
    })
  })

  it('rejects provider errors without exposing their values', () => {
    expect(
      parseAuthDeepLink(
        'dutchlearning://?error=access_denied&error_description=sensitive'
      )
    ).toEqual({
      kind: INVALID_AUTH_CALLBACK,
      reason: 'provider-error',
    })
  })

  it('rejects unknown callback types', () => {
    expect(
      parseAuthDeepLink(`dutchlearning://#${AUTH_FRAGMENT}&type=unknown`)
    ).toEqual({
      kind: INVALID_AUTH_CALLBACK,
      reason: 'unsupported-type',
    })
  })

  it('ignores non-auth deep links', () => {
    expect(parseAuthDeepLink('dutchlearning://share/collection-token')).toEqual(
      {
        kind: 'not-auth-callback',
      }
    )
  })
})
