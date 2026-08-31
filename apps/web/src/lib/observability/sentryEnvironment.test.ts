import { resolveSentryEnvironment } from './sentryEnvironment'

describe('resolveSentryEnvironment', () => {
  it.each(['development', 'preview', 'production'] as const)(
    'uses the Vercel %s environment',
    environment => {
      expect(resolveSentryEnvironment(environment, 'production')).toBe(
        environment
      )
    }
  )

  it('falls back to production for non-Vercel production builds', () => {
    expect(resolveSentryEnvironment(undefined, 'production')).toBe('production')
  })

  it('falls back to development outside production', () => {
    expect(resolveSentryEnvironment(undefined, 'development')).toBe(
      'development'
    )
    expect(resolveSentryEnvironment('invalid', 'test')).toBe('development')
  })
})
