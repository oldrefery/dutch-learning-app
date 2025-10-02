import { Sentry } from '@/lib/sentry'
import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Centralized logging utility following Sentry best practices
 * Replaces console.log, console.warn, console.error with Sentry breadcrumbs
 */

type LogLevel = 'debug' | 'info' | 'warning' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface SupabaseErrorContext extends LogContext {
  operation: string
  userId?: string
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
 * Format Supabase error into a readable error message
 * Supabase errors have structure: { message, details, hint, code }
 */
function formatSupabaseError(error: PostgrestError): string {
  const parts: string[] = []

  // Primary error message
  if (error.message) {
    parts.push(error.message)
  }

  // Add error code for quick identification
  if (error.code) {
    parts.push(`[${error.code}]`)
  }

  // Details on a new line for better readability
  if (error.details) {
    parts.push(`\nDetails: ${error.details}`)
  }

  // Hint provides actionable guidance
  if (error.hint) {
    parts.push(`\n💡 Hint: ${error.hint}`)
  }

  return parts.length > 0 ? parts.join(' ') : 'Unknown Supabase error'
}

/**
 * Log and capture Supabase error to Sentry with proper formatting
 * This ensures Supabase errors are properly displayed in Sentry with all details
 */
export function logSupabaseError(
  message: string,
  error: PostgrestError,
  context: SupabaseErrorContext
) {
  const formattedError = formatSupabaseError(error)
  const fullMessage = `${message}: ${formattedError}`

  // Add breadcrumb for context
  Sentry.addBreadcrumb({
    category: 'supabase',
    message: fullMessage,
    level: 'error',
    data: {
      ...context,
      supabaseError: {
        code: error.code || 'unknown',
        message: error.message || 'No message',
        details: error.details || 'No details',
        hint: error.hint || 'No hint',
      },
    },
  })

  // Capture as exception with all context
  Sentry.captureException(new Error(fullMessage), {
    tags: {
      operation: context.operation,
      errorCode: error.code || 'unknown',
    },
    extra: {
      ...context,
      supabaseError: {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    },
    // Fingerprinting: group errors by operation and error code
    // This ensures same errors are grouped together in Sentry
    fingerprint: ['supabase-error', context.operation, error.code || 'unknown'],
  })

  // In development, also log to console
  if (__DEV__) {
    console.error(`❌ [supabase] ${fullMessage}`, {
      context,
      supabaseError: error,
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
  supabaseError: logSupabaseError,
}
