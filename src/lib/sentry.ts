import * as SentryLib from '@sentry/react-native'

// Flag to prevent multiple initializations
let sentryInitialized = false

export function initializeSentry() {
  if (sentryInitialized) {
    return
  }

  // Enable Sentry in development for debugging crashes
  const isDevelopment = __DEV__
  // Always initialize Sentry (removed development check for debugging)
  SentryLib.init({
    dsn: 'https://b9380e4ad548d88fe5c8bfecabcdf2e3@o4506263035904000.ingest.us.sentry.io/4509999490727936',
    debug: !isDevelopment, // Enable debug in development
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      SentryLib.reactNativeTracingIntegration({}),
      SentryLib.mobileReplayIntegration(),
    ],
  })

  sentryInitialized = true
}

// Initialize Sentry immediately when this module is imported
initializeSentry()

// Always export the full Sentry for crash collection in development
export const Sentry = SentryLib
