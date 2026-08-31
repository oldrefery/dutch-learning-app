import { resolveSiteOrigin } from './site-origin'

describe('resolveSiteOrigin', () => {
  it('prefers the explicitly configured production origin', () => {
    expect(
      resolveSiteOrigin({
        siteUrl: 'https://woordenaar.app',
        vercelUrl: 'woordenaar-preview.vercel.app',
      })
    ).toBe('https://woordenaar.app')
  })

  it('uses the Vercel deployment origin for previews', () => {
    expect(
      resolveSiteOrigin({ vercelUrl: 'woordenaar-preview.vercel.app' })
    ).toBe('https://woordenaar-preview.vercel.app')
  })

  it('falls back to localhost for local development', () => {
    expect(resolveSiteOrigin({})).toBe('http://localhost:3000')
  })

  it('rejects insecure remote and path-based origins', () => {
    expect(() =>
      resolveSiteOrigin({ siteUrl: 'http://woordenaar.app' })
    ).toThrow('must use HTTPS')
    expect(() =>
      resolveSiteOrigin({ siteUrl: 'https://woordenaar.app/auth/callback' })
    ).toThrow('must not include a path')
  })
})
