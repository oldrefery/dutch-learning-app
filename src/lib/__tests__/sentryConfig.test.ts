import {
  getSentryRuntimeConfig,
  getSentrySamplingConfig,
  resolveSentryEnvironment,
  resolveSentryRelease,
} from '../sentryConfig'

describe('Sentry runtime configuration', () => {
  it.each([
    [true, 'production', 'development'],
    [false, 'production', 'production'],
    [false, 'preview', 'preview'],
    [false, 'development', 'development'],
    [false, 'unexpected-channel', 'test'],
    [false, null, 'test'],
  ] as const)(
    'resolves development=%s and channel=%s to %s',
    (isDevelopment, channel, expectedEnvironment) => {
      expect(resolveSentryEnvironment(isDevelopment, channel)).toBe(
        expectedEnvironment
      )
    }
  )

  it('uses native binary metadata for release and dist', () => {
    expect(
      resolveSentryRelease({
        applicationId: 'com.example.app',
        nativeApplicationVersion: '2.3.4',
        nativeBuildVersion: '52',
        fallbackApplicationId: 'fallback-app',
        fallbackApplicationVersion: '0.0.0',
        fallbackBuildVersion: 'fallback',
      })
    ).toEqual({
      release: 'com.example.app@2.3.4+52',
      dist: '52',
    })
  })

  it('uses deterministic fallback metadata outside a native binary', () => {
    expect(
      resolveSentryRelease({
        applicationId: null,
        nativeApplicationVersion: null,
        nativeBuildVersion: null,
        fallbackApplicationId: 'dutch-learning-app',
        fallbackApplicationVersion: '1.12.2',
        fallbackBuildVersion: 'development-runtime',
      })
    ).toEqual({
      release: 'dutch-learning-app@1.12.2+development-runtime',
      dist: 'development-runtime',
    })
  })

  it('keeps production performance and replay sampling bounded', () => {
    expect(getSentrySamplingConfig('production')).toEqual({
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.01,
      replaysSessionSampleRate: 0.01,
      replaysOnErrorSampleRate: 1,
    })
  })

  it('disables performance and replay sampling for local development', () => {
    expect(getSentrySamplingConfig('development')).toEqual({
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    })
  })

  it('builds the active runtime config from native metadata', () => {
    expect(getSentryRuntimeConfig()).toEqual({
      environment: 'development',
      release: 'com.oldrefery.dutch-learning-app@1.0.0+1',
      dist: '1',
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    })
  })
})
