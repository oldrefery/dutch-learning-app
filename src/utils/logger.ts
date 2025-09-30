import { Sentry } from '@/lib/sentry'

/**
 * Centralized logging utility following Sentry best practices
 * Replaces console.log, console.warn, console.error with Sentry breadcrumbs
 */

type LogLevel = 'debug' | 'info' | 'warning' | 'error'

interface LogContext {
  [key: string]: unknown
}

/**
 * Log a message as a Sentry breadcrumb
 * In development, also outputs to console
 */
function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  category = 'app'
) {
  // Add breadcrumb for Sentry
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data: context,
  })

  // In development, also output to the console for immediate feedback
  if (__DEV__) {
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
    }[level]

    const consoleMethod =
      level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log'

    if (context && Object.keys(context).length > 0) {
      console[consoleMethod](`${emoji} [${category}] ${message}`, context)
    } else {
      console[consoleMethod](`${emoji} [${category}] ${message}`)
    }
  }
}

/**
 * Log debug information (development only)
 */
export function logDebug(
  message: string,
  context?: LogContext,
  category?: string
) {
  log('debug', message, context, category)
}

/**
 * Log informational message
 */
export function logInfo(
  message: string,
  context?: LogContext,
  category?: string
) {
  log('info', message, context, category)
}

/**
 * Log warning message
 */
export function logWarning(
  message: string,
  context?: LogContext,
  category?: string
) {
  log('warning', message, context, category)
}

/**
 * Log error message and optionally capture as a Sentry event
 * For critical errors, also captures as a Sentry event (not just breadcrumb)
 */
export function logError(
  message: string,
  error?: Error | unknown,
  context?: LogContext,
  category = 'app',
  captureEvent = false
) {
  // Add breadcrumb
  log(
    'error',
    message,
    { ...context, error: error instanceof Error ? error.message : error },
    category
  )

  // For critical errors, also capture as Sentry event
  if (captureEvent && error) {
    Sentry.captureException(error, {
      tags: { category },
      extra: { message, ...context },
    })
  }
}

/**
 * Legacy console replacement helpers
 * Use these to gradually migrate from console.* to proper logging
 */
export const logger = {
  debug: logDebug,
  info: logInfo,
  log: logInfo, // alias for console.log
  warn: logWarning,
  error: logError,
}
