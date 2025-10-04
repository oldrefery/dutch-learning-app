// Supabase client configuration for React Native/Expo
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

// Secure storage adapter for expo-secure-store
// Using AFTER_FIRST_UNLOCK accessibility to allow keychain access even when device is locked
// (as long as it's been unlocked once since boot). This prevents "User interaction is not allowed" errors.
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      })
    } catch (error) {
      // If keychain access fails, log the error but return null to allow graceful degradation
      console.error('SecureStore getItem error:', error)
      return null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      })
    } catch (error) {
      console.error('SecureStore setItem error:', error)
      // Don't throw - let the auth flow handle the error
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch (error) {
      console.error('SecureStore removeItem error:', error)
      // Don't throw - item may not exist or keychain may be inaccessible
    }
  },
}

// Environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with secure storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Export types for convenience
export type { User, Session } from '@supabase/supabase-js'
