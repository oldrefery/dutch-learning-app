import { Sentry } from '@/lib/sentry'
import type { PostgrestError } from '@supabase/supabase-js'
import { sanitizeLogContext, sanitizeLogMessage } from './logSanitizer'

/**
 * Centralized logging utility following Sentry best practices
 * Replaces console.log, console.warn, console.error with Sentry breadcrumbs
 */

type LogLevel = 'debug' | 'info' | 'warning' | 'error'

/**
 * Detect network-related errors that are expected in offline-first architecture.
 * These should not be reported as Sentry exceptions to avoid noise.
 */
export function isNetworkError(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  return (
    lowerMessage.includes('network request failed') ||
    lowerMessage.includes('network error') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('enetunreach')
  )
}

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
  const sanitizedMessage = sanitizeLogMessage(message)
  const sanitizedContext = context ? sanitizeLogContext(context) : undefined

  // Add breadcrumb for Sentry
  Sentry.addBreadcrumb({
    category,
    message: sanitizedMessage,
    level,
    data: sanitizedContext,
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

    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      console[consoleMethod](
        `${emoji} [${category}] ${sanitizedMessage}`,
        sanitizedContext
      )
    } else {
      console[consoleMethod](`${emoji} [${category}] ${sanitizedMessage}`)
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
  const sanitizedContext = context ? sanitizeLogContext(context) : undefined
  const sanitizedMessage = sanitizeLogMessage(message)
  const sanitizedError =
    error instanceof Error ? sanitizeLogMessage(error.message) : error

  // Add breadcrumb
  log(
    'error',
    sanitizedMessage,
    { ...sanitizedContext, error: sanitizedError },
    category
  )

  // For critical errors, also capture as Sentry event
  if (captureEvent && error) {
    Sentry.captureException(error, {
      tags: { category },
      extra: { message: sanitizedMessage, ...sanitizedContext },
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
  const formattedError = sanitizeLogMessage(formatSupabaseError(error))
  const fullMessage = sanitizeLogMessage(`${message}: ${formattedError}`)
  const sanitizedContext = sanitizeLogContext(context)
  const sanitizedSupabaseError = sanitizeLogContext({
    code: error.code || 'unknown',
    message: error.message || 'No message',
    details: error.details || 'No details',
    hint: error.hint || 'No hint',
  })

  // Add breadcrumb for context
  Sentry.addBreadcrumb({
    category: 'supabase',
    message: fullMessage,
    level: 'error',
    data: {
      ...sanitizedContext,
      supabaseError: sanitizedSupabaseError,
    },
  })

  // Network errors are expected in offline-first architecture — log as warning, not exception
  if (
    isNetworkError(error.message || '') ||
    isNetworkError(error.details || '')
  ) {
    Sentry.captureMessage(fullMessage, {
      level: 'warning',
      tags: {
        operation: context.operation,
        errorCode: 'network',
      },
      extra: {
        ...sanitizedContext,
        supabaseError: sanitizedSupabaseError,
      },
      fingerprint: ['supabase-network-error', context.operation],
    })
  } else {
    // Capture as exception with all context
    Sentry.captureException(new Error(fullMessage), {
      tags: {
        operation: context.operation,
        errorCode: error.code || 'unknown',
      },
      extra: {
        ...sanitizedContext,
        supabaseError: sanitizedSupabaseError,
      },
      // Fingerprinting: group errors by operation and error code
      // This ensures same errors are grouped together in Sentry
      fingerprint: [
        'supabase-error',
        context.operation,
        error.code || 'unknown',
      ],
    })
  }

  // In development, also log to console
  if (__DEV__) {
    console.error(`❌ [supabase] ${fullMessage}`, {
      context: sanitizedContext,
      supabaseError: sanitizedSupabaseError,
    })
  }
}

export { sanitizeLogContext, sanitizeLogMessage }

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
