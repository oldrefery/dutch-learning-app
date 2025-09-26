import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { supabase } from '@/lib/supabaseClient'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import {
  collectionSharingService,
  type SharedCollectionWords,
} from '@/services/collectionSharingService'
import { SharedCollectionLoadingScreen } from '@/components/SharedCollectionLoadingScreen'
import { SharedCollectionErrorScreen } from '@/components/SharedCollectionErrorScreen'
import { SharedCollectionHeader } from '@/components/SharedCollectionHeader'
import { ImportCard } from '@/components/ImportCard'
import { WordsPreview } from '@/components/WordsPreview'

export default function SharedCollectionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [sharedData, setSharedData] = useState<SharedCollectionWords | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const colorScheme = useColorScheme() ?? 'light'

  useEffect(() => {
    checkAuthAndLoad()
  }, [checkAuthAndLoad])

  const checkAuthAndLoad = useCallback(async () => {
    try {
      // First, check if the user is authenticated
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession()

      if (authError || !session) {
        // Save the current deep link URL for deferred deep linking
        const currentUrl = `/share/${token}`

        // Store the intended destination in query params
        router.replace(
          `/(auth)/login?redirect=${encodeURIComponent(currentUrl)}`
        )
        return
      }

      // Now proceed with loading the shared collection
      if (!token) {
        setError('Invalid share link')
        setLoading(false)
        return
      }

      loadSharedCollection()
    } catch (err) {
      console.error('Auth check failed:', err)
      // Also preserve a deep link on error
      const currentUrl = `/share/${token}`
      router.replace(`/(auth)/login?redirect=${encodeURIComponent(currentUrl)}`)
    }
  }, [loadSharedCollection, token])

  const loadSharedCollection = async () => {
    try {
      console.log('🔄 [SharedCollectionScreen] Loading shared collection', {
        token,
      })

      const result =
        await collectionSharingService.getSharedCollectionWords(token)

      if (!result.success) {
        console.log('❌ [SharedCollectionScreen] Failed to load collection', {
          error: result.error,
        })
        setError(getErrorMessage(result.error))
        setLoading(false)
        return
      }

      console.log('✅ [SharedCollectionScreen] Collection loaded', {
        collectionName: result.data.collection.name,
        wordCount: result.data.words.length,
      })

      setSharedData(result.data)
      setError(null)
    } catch (err) {
      console.error('❌ [SharedCollectionScreen] Unexpected error:', err)

      // Handle specific error cases
      if (err instanceof Error) {
        if (
          err.message.includes('network') ||
          err.message.includes('fetch') ||
          err.message.includes('NetworkError')
        ) {
          setError(
            'Network error. Please check your internet connection and try again.'
          )
        } else if (err.message.includes('timeout')) {
          setError(
            'Request timed out. The server might be experiencing high load.'
          )
        } else if (
          err.message.includes('unauthorized') ||
          err.message.includes('auth')
        ) {
          setError('Authentication error. Please try accessing the link again.')
        } else {
          setError('Failed to load shared collection. Please try again.')
        }
      } else {
        setError('An unexpected error occurred while loading the collection.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'COLLECTION_NOT_FOUND':
        return 'This collection no longer exists or the share link has expired. The creator might have deleted the collection or stopped sharing it.'
      case 'COLLECTION_NOT_SHARED':
        return 'This collection is no longer being shared publicly. The creator has disabled sharing for this collection.'
      case 'DATABASE_ERROR':
        return 'Server error occurred while loading the collection. Please try again in a few minutes.'
      case 'UNAUTHORIZED':
        return 'Access denied. You may need to sign in or the share link might be invalid.'
      default:
        return 'Unable to load the shared collection. Please check your internet connection and try again.'
    }
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    loadSharedCollection()
  }

  const handleImportCollection = () => {
    if (!sharedData) return

    console.log('🔄 [SharedCollectionScreen] Navigate to import screen', {
      token,
      collectionName: sharedData.collection.name,
      wordCount: sharedData.words.length,
    })

    router.push(`/import/${token}`)
  }

  const handleGoBack = () => {
    // Force proper app initialization through index.tsx
    router.replace('/')
  }

  if (loading) {
    return <SharedCollectionLoadingScreen />
  }

  if (error || !sharedData) {
    return (
      <SharedCollectionErrorScreen
        error={error || 'No data available'}
        onRetry={handleRetry}
        onGoBack={handleGoBack}
        showRetry={true}
      />
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: sharedData.collection.name,
          headerBackVisible: false,
          headerStyle: {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.background.secondary,
          },
          headerLeft: () => (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleGoBack}
              accessibilityLabel="Cancel"
              accessibilityHint="Cancel and go to collections"
            >
              <TextThemed
                style={styles.cancelButtonText}
                lightColor={Colors.primary.DEFAULT}
                darkColor={Colors.dark.tint}
              >
                Cancel
              </TextThemed>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.importButton}
              onPress={handleImportCollection}
              accessibilityLabel="Import collection"
              accessibilityHint="Import this shared collection to your library"
            >
              <Ionicons
                name="download-outline"
                size={24}
                color={
                  colorScheme === 'dark'
                    ? Colors.dark.tint
                    : Colors.primary.DEFAULT
                }
              />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SharedCollectionHeader sharedData={sharedData} />

        <ImportCard onPress={handleImportCollection} />

        <WordsPreview sharedData={sharedData} />
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  importButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '400',
  },
})
