// Supabase client configuration for React Native/Expo
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { MMKV } from 'react-native-mmkv'
import { createClient } from '@supabase/supabase-js'

const ENCRYPTION_KEY_NAME = 'supabase-session-encryption-key'

// Generate or retrieve encryption key from SecureStore (async)
const getEncryptionKey = async (): Promise<string> => {
  try {
    const existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    })

    if (existingKey) {
      return existingKey
    }

    // Generate new encryption key using Crypto
    const newKey = Crypto.randomUUID()
    await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, newKey, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    })

    return newKey
  } catch (error) {
    console.error('Error accessing encryption key:', error)
    // Fallback to a static key (not recommended for production)
    return 'fallback-encryption-key-change-me'
  }
}

// Initialize MMKV with encryption key
let mmkvStorage: MMKV | null = null
let storageInitPromise: Promise<MMKV> | null = null

const getMMKVStorage = async (): Promise<MMKV> => {
  if (mmkvStorage) {
    return mmkvStorage
  }

  if (!storageInitPromise) {
    storageInitPromise = getEncryptionKey().then(encryptionKey => {
      mmkvStorage = new MMKV({
        id: 'supabase-session-storage',
        encryptionKey,
      })
      return mmkvStorage
    })
  }

  return storageInitPromise
}

// MMKV storage adapter for Supabase (solves 2048 byte SecureStore limit)
const MMKVStorageAdapter = {
  getItem: async (key: string) => {
    const storage = await getMMKVStorage()
    const value = storage.getString(key)
    return value ?? null
  },
  setItem: async (key: string, value: string) => {
    const storage = await getMMKVStorage()
    storage.set(key, value)
  },
  removeItem: async (key: string) => {
    const storage = await getMMKVStorage()
    storage.delete(key)
  },
}

// Environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with encrypted MMKV storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: MMKVStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Export types for convenience
export type { User, Session } from '@supabase/supabase-js'
