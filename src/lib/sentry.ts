import * as SentryLib from '@sentry/react-native'
import { supabaseIntegration } from '@supabase/sentry-js-integration'
import { supabase } from './supabaseClient'

// Flag to prevent multiple initializations
let sentryInitialized = false

export function initializeSentry() {
  if (sentryInitialized) {
    return
  }

  // Enable Sentry in development for debugging crashes
  const isDevelopment = __DEV__

  // Get Supabase URL for filtering
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

  // Always initialize Sentry (removed development check for debugging)
  SentryLib.init({
    dsn: 'https://b9380e4ad548d88fe5c8bfecabcdf2e3@o4506263035904000.ingest.us.sentry.io/4509999490727936',
    debug: isDevelopment, // Enable debug in development (fixed)
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      SentryLib.reactNativeTracingIntegration({
        // Prevent duplicate spans for Supabase requests
        shouldCreateSpanForRequest: url => {
          if (!supabaseUrl) return true
          // Filter out Supabase REST API calls to avoid duplicate spans
          return !url.startsWith(`${supabaseUrl}/rest`)
        },
      }),
      SentryLib.mobileReplayIntegration(),
      // Supabase integration for automatic error tracking and tracing
      supabaseIntegration(supabase, SentryLib, {
        tracing: true,
        breadcrumbs: true,
        errors: true,
      }),
    ],
  })

  sentryInitialized = true
}

// Initialize Sentry immediately when this module is imported
initializeSentry()

// Always export the full Sentry for crash collection in development
export const Sentry = SentryLib
