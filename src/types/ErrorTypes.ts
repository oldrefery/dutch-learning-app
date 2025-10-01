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
export function categorizeSupabaseError(error: unknown): AppError {
  // FunctionsFetchError - Network issue, function couldn't be reached
  if (error instanceof FunctionsFetchError) {
    return new NetworkError(
      'Failed to reach Edge Function',
      'Connection error. Please check your internet and try again.',
      error as Error,
      { errorType: 'FunctionsFetchError' }
    )
  }

  // Check if it's a Supabase error with status code
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const statusError = error as { status: number; message: string }

    // 4xx - Client errors
    if (statusError.status >= 400 && statusError.status < 500) {
      return new ClientError(
        statusError.message || 'Client error',
        statusError.status,
        'Invalid request. Please check your input.',
        error instanceof Error ? error : undefined
      )
    }

    // 5xx - Server errors
    if (statusError.status >= 500) {
      return new ServerError(
        statusError.message || 'Server error',
        statusError.status,
        'Server error. Please try again later.',
        statusError.status === 503 || statusError.status === 504, // Retry on 503/504
        error instanceof Error ? error : undefined
      )
    }
  }

  // Generic Error
  if (error instanceof Error) {
    // Check for common network error messages
    const networkPatterns = [
      'network request failed',
      'network error',
      'timeout',
      'fetch failed',
      'connection refused',
      'econnrefused',
    ]

    const errorMessage = error.message.toLowerCase()
    if (networkPatterns.some(pattern => errorMessage.includes(pattern))) {
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

  // Unknown error type
  return new ServerError(
    'Unknown error occurred',
    undefined,
    'Something went wrong. Please try again.',
    false,
    undefined,
    { rawError: error }
  )
}
