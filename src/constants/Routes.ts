/**
 * Application routes constants
 * Centralized route definitions following Expo Router best practices
 * @see https://docs.expo.dev/router/reference/typed-routes/
 */

export const ROUTES = {
  // Auth routes
  AUTH: {
    LOGIN: '/(auth)/login' as const,
    SIGNUP: '/(auth)/signup' as const,
  },

  // Main app routes
  TABS: {
    ROOT: '/(tabs)' as const,
    HOME: '/(tabs)' as const,
    COLLECTIONS: '/(tabs)' as const,
    ADD_WORD: '/(tabs)/add-word' as const,
    REVIEW: '/(tabs)/review' as const,
    SETTINGS: '/(tabs)/settings' as const,
  },

  // Dynamic routes - use functions for type safety
  COLLECTION_DETAIL: (id: string) => `/collection/${id}` as const,
  IMPORT_COLLECTION: (token: string) => `/import/${token}` as const,

  // Other routes
  MODAL: '/modal' as const,
  ROOT: '/' as const,
} as const

/**
 * Helper functions for complex route operations
 */
export const RouteHelpers = {
  /**
   * Create auth redirect URL
   */
  createAuthRedirect: (targetRoute: string) =>
    `${ROUTES.AUTH.LOGIN}?redirect=${encodeURIComponent(targetRoute)}` as const,

  /**
   * Navigate back helper
   */
  back: () => 'BACK' as const,
} as const

/**
 * Type definitions for route parameters
 */
export type RouteParams = {
  'collection/[id]': { id: string }
  'import/[token]': { token: string }
}

export type Route = (typeof ROUTES)[keyof typeof ROUTES]
