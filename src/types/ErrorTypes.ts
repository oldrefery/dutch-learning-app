/**
 * Custom Error Types for Better Error Categorization
 * Following Supabase and React Native best practices for 2025
 */

import { FunctionsFetchError } from '@supabase/supabase-js'

// Error categories for user-facing messages
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN',
}

// Error severity for Sentry reporting
export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

// Base error interface
export interface AppError {
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  userMessage: string
  isRetryable: boolean
  originalError?: Error
  context?: Record<string, unknown>
}

/**
 * Network Error - Temporary issues (no connection, timeout)
 * Should be retried automatically
 */
export class NetworkError extends Error implements AppError {
  category = ErrorCategory.NETWORK
  severity = ErrorSeverity.WARNING
  isRetryable = true
  userMessage: string
  originalError?: Error
  context?: Record<string, unknown>

  constructor(
    message: string,
    userMessage: string = 'Network connection issue. Please check your internet connection.',
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'NetworkError'
    this.userMessage = userMessage
    this.originalError = originalError
    this.context = context
  }
}

/**
 * Server Error - Edge Function or API errors (5xx)
 * May be retryable depending on the error
 */
export class ServerError extends Error implements AppError {
  category = ErrorCategory.SERVER
  severity = ErrorSeverity.ERROR
  isRetryable: boolean
  userMessage: string
  originalError?: Error
  context?: Record<string, unknown>
  statusCode?: number

  constructor(
    message: string,
    statusCode?: number,
    userMessage: string = 'Server error occurred. Please try again later.',
    isRetryable: boolean = false,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ServerError'
    this.statusCode = statusCode
    this.userMessage = userMessage
    this.isRetryable = isRetryable
    this.originalError = originalError
    this.context = context
  }
}

/**
 * Client Error - Bad request, validation errors (4xx)
 * Not retryable, user needs to fix input
 */
export class ClientError extends Error implements AppError {
  category = ErrorCategory.CLIENT
  severity = ErrorSeverity.INFO
  isRetryable = false
  userMessage: string
  originalError?: Error
  context?: Record<string, unknown>
  statusCode?: number

  constructor(
    message: string,
    statusCode?: number,
    userMessage: string = 'Invalid request. Please check your input.',
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ClientError'
    this.statusCode = statusCode
    this.userMessage = userMessage
    this.originalError = originalError
    this.context = context
  }
}

/**
 * Validation Error - Input validation failed
 * Not retryable, user needs to fix input
 */
export class ValidationError extends Error implements AppError {
  category = ErrorCategory.VALIDATION
  severity = ErrorSeverity.INFO
  isRetryable = false
  userMessage: string
  originalError?: Error
  context?: Record<string, unknown>
  field?: string

  constructor(
    message: string,
    field?: string,
    userMessage: string = 'Please check your input and try again.',
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.userMessage = userMessage
    this.originalError = originalError
    this.context = context
  }
}

/**
 * Helper function to categorize Supabase errors
 */
type SupabaseStatusError = {
  status: number
  message?: string
}

const NETWORK_ERROR_PATTERNS = [
  'network request failed',
  'network error',
  'timeout',
  'fetch failed',
  'connection refused',
  'econnrefused',
]

const isKnownAppError = (error: unknown): error is AppError =>
  error instanceof NetworkError ||
  error instanceof ServerError ||
  error instanceof ClientError ||
  error instanceof ValidationError

const getSupabaseStatusError = (error: unknown): SupabaseStatusError | null => {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null
  }

  const rawStatus = (error as { status?: unknown }).status
  if (typeof rawStatus !== 'number') {
    return null
  }

  const rawMessage = (error as { message?: unknown }).message
  return {
    status: rawStatus,
    message: typeof rawMessage === 'string' ? rawMessage : undefined,
  }
}

const categorizeByStatusCode = (
  statusError: SupabaseStatusError,
  originalError?: Error
): AppError | null => {
  if (statusError.status >= 400 && statusError.status < 500) {
    return new ClientError(
      statusError.message || 'Client error',
      statusError.status,
      'Invalid request. Please check your input.',
      originalError
    )
  }

  if (statusError.status >= 500) {
    return new ServerError(
      statusError.message || 'Server error',
      statusError.status,
      'Server error. Please try again later.',
      statusError.status === 503 || statusError.status === 504,
      originalError
    )
  }

  return null
}

const categorizeGenericError = (error: Error): AppError => {
  const errorMessage = error.message.toLowerCase()
  if (NETWORK_ERROR_PATTERNS.some(pattern => errorMessage.includes(pattern))) {
    return new NetworkError(
      error.message,
      'Connection error. Please check your internet and try again.',
      error
    )
  }

  return new ServerError(
    error.message,
    undefined,
    'An unexpected error occurred. Please try again.',
    false,
    error
  )
}

export function categorizeSupabaseError(error: unknown): AppError {
  if (isKnownAppError(error)) {
    return error
  }

  if (error instanceof FunctionsFetchError) {
    return new NetworkError(
      'Failed to reach Edge Function',
      'Connection error. Please check your internet and try again.',
      error as Error,
      { errorType: 'FunctionsFetchError' }
    )
  }

  const statusError = getSupabaseStatusError(error)
  if (statusError) {
    const categorizedError = categorizeByStatusCode(
      statusError,
      error instanceof Error ? error : undefined
    )
    if (categorizedError) {
      return categorizedError
    }
  }

  if (error instanceof Error) {
    return categorizeGenericError(error)
  }

  return new ServerError(
    'Unknown error occurred',
    undefined,
    'Something went wrong. Please try again.',
    false,
    undefined,
    { rawError: error }
  )
}
