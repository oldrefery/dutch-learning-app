import * as Sentry from '@sentry/nextjs'

import { resolveSentryEnvironment } from '@/lib/observability/sentryEnvironment'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const environment = resolveSentryEnvironment(
  process.env.VERCEL_ENV,
  process.env.NODE_ENV
)

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment,
  sendDefaultPii: false,
  tracesSampleRate: 1,
})
