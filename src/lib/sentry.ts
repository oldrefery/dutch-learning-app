import * as SentryLib from '@sentry/react-native'
import type React from 'react'

// Flag to prevent multiple initializations
let sentryInitialized = false

export function initializeSentry() {
  if (sentryInitialized) {
    return
  }

  // Skip Sentry initialization entirely in development to avoid interference
  if (__DEV__) {
    console.log('Sentry disabled in development mode')
    sentryInitialized = true
    return
  }

  SentryLib.init({
    dsn: 'https://b9380e4ad548d88fe5c8bfecabcdf2e3@o4506263035904000.ingest.us.sentry.io/4509999490727936',
    debug: false,
    integrations: [SentryLib.reactNativeTracingIntegration({})],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    tracesSampleRate: 1.0,
  })

  sentryInitialized = true
}

// Initialize Sentry immediately when this module is imported
initializeSentry()

// Create a Sentry object with fallbacks for development
export const Sentry = __DEV__
  ? {
      // Provide no-op functions for development
      wrap: <T extends React.ComponentType>(component: T) => component, // Just return the component without wrapping
      captureException: () => {},
      captureMessage: () => {},
      addBreadcrumb: () => {},
      setUser: () => {},
      setTag: () => {},
      setContext: () => {},
    }
  : SentryLib
