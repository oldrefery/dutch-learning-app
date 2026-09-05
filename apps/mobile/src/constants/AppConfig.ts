/**
 * Application Configuration Constants - Re-export from Single Source
 *
 * This file re-exports all constants from the shared constants file
 * to maintain a clean import structure for the React Native app.
 *
 * All constants are defined in the shared @woordenaar/domain workspace.
 * This ensures Edge Functions, mobile, and web use identical values.
 */

// Re-export all constants from the single source of truth
export * from '@woordenaar/domain/app-config'

// Note: Edge Functions keep a compatibility re-export in their _shared folder.
// This approach ensures:
// 1. Single source of truth
// 2. No duplication
// 3. Consistent values across Edge Functions and React Native app
// 4. Easy maintenance
