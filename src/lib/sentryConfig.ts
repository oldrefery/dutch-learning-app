import * as Application from 'expo-application'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

export type SentryEnvironment =
  | 'development'
  | 'preview'
  | 'production'
  | 'test'

export interface SentrySamplingConfig {
  tracesSampleRate: number
  profilesSampleRate: number
  replaysSessionSampleRate: number
  replaysOnErrorSampleRate: number
}

interface SentryReleaseSource {
  applicationId: string | null
  nativeApplicationVersion: string | null
  nativeBuildVersion: string | null
  fallbackApplicationId: string
  fallbackApplicationVersion: string
  fallbackBuildVersion: string
}

export interface SentryRuntimeConfig extends SentrySamplingConfig {
  environment: SentryEnvironment
  release: string
  dist: string
}

const SENTRY_SAMPLING_BY_ENVIRONMENT: Record<
  SentryEnvironment,
  SentrySamplingConfig
> = {
  development: {
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  },
  test: {
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  },
  preview: {
    tracesSampleRate: 0.25,
    profilesSampleRate: 0.05,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1,
  },
  production: {
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.01,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1,
  },
}

export function resolveSentryEnvironment(
  isDevelopment: boolean,
  updateChannel: string | null | undefined
): SentryEnvironment {
  if (isDevelopment) {
    return 'development'
  }

  switch (updateChannel?.trim().toLowerCase()) {
    case 'production':
      return 'production'
    case 'preview':
      return 'preview'
    case 'development':
      return 'development'
    default:
      return 'test'
  }
}

export function getSentrySamplingConfig(
  environment: SentryEnvironment
): SentrySamplingConfig {
  return { ...SENTRY_SAMPLING_BY_ENVIRONMENT[environment] }
}

export function resolveSentryRelease({
  applicationId,
  nativeApplicationVersion,
  nativeBuildVersion,
  fallbackApplicationId,
  fallbackApplicationVersion,
  fallbackBuildVersion,
}: SentryReleaseSource): Pick<SentryRuntimeConfig, 'release' | 'dist'> {
  const releaseId = applicationId || fallbackApplicationId
  const releaseVersion = nativeApplicationVersion || fallbackApplicationVersion
  const dist = nativeBuildVersion || fallbackBuildVersion

  return {
    release: `${releaseId}@${releaseVersion}+${dist}`,
    dist,
  }
}

export function getSentryRuntimeConfig(): SentryRuntimeConfig {
  const environment = resolveSentryEnvironment(__DEV__, Updates.channel)
  const fallbackApplicationVersion =
    Constants.expoConfig?.version || 'development'
  const fallbackBuildVersion =
    Updates.runtimeVersion || `${environment}-runtime`
  const release = resolveSentryRelease({
    applicationId: Application.applicationId,
    nativeApplicationVersion: Application.nativeApplicationVersion,
    nativeBuildVersion: Application.nativeBuildVersion,
    fallbackApplicationId: Constants.expoConfig?.slug || 'dutch-learning-app',
    fallbackApplicationVersion,
    fallbackBuildVersion,
  })

  return {
    environment,
    ...release,
    ...getSentrySamplingConfig(environment),
  }
}
