/**
 * Application storage utility using MMKV for user preferences
 * Separate from Supabase auth storage for better organization
 */

import { MMKV } from 'react-native-mmkv'

// Initialize MMKV instance for app preferences
// No encryption needed for non-sensitive data like UI preferences
export const appStorage = new MMKV({
  id: 'app-preferences-storage',
})

// Storage keys constants
const STORAGE_KEYS = {
  LAST_SELECTED_COLLECTION: 'lastSelectedCollectionId',
} as const

/**
 * Get the last selected collection ID
 */
export function getLastSelectedCollection(): string | undefined {
  return appStorage.getString(STORAGE_KEYS.LAST_SELECTED_COLLECTION)
}

/**
 * Save the last selected collection ID
 */
export function setLastSelectedCollection(collectionId: string): void {
  appStorage.set(STORAGE_KEYS.LAST_SELECTED_COLLECTION, collectionId)
}

/**
 * Clear the last selected collection
 */
export function clearLastSelectedCollection(): void {
  appStorage.delete(STORAGE_KEYS.LAST_SELECTED_COLLECTION)
}
