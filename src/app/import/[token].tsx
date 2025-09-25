import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import {
  collectionSharingService,
  type SharedCollectionWords,
} from '@/services/collectionSharingService'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { supabase } from '@/lib/supabase'
import type { Word } from '@/types/database'
import { SharedCollectionLoadingScreen } from '@/components/SharedCollectionLoadingScreen'
import { SharedCollectionErrorScreen } from '@/components/SharedCollectionErrorScreen'
import { ImportCollectionSelector } from '@/components/ImportCollectionSelector'
import { SelectAllToggle } from '@/components/SelectAllToggle'
import { WordSelectionList } from '@/components/WordSelectionList'

interface WordSelectionItem {
  word: Word
  selected: boolean
  isDuplicate: boolean
  existingInCollection?: string // название коллекции где уже есть слово
}

export default function ImportSelectionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [sharedData, setSharedData] = useState<SharedCollectionWords | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [wordSelections, setWordSelections] = useState<WordSelectionItem[]>([])
  const [targetCollectionId, setTargetCollectionId] = useState<string>('')
  const colorScheme = useColorScheme() ?? 'light'

  const {
    collections,
    words,
    addWordsToCollection,
    currentUserId,
    initializeApp,
  } = useApplicationStore()

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
        const currentUrl = `/import/${token}`
        router.replace(
          `/(auth)/login?redirect=${encodeURIComponent(currentUrl)}`
        )
        return
      }

      // Now proceed with loading
      if (!token) {
        setError('Invalid share link')
        setLoading(false)
        return
      }

      const initializeAndLoad = async () => {
        // Load shared collection
        await loadSharedCollection()

        // Initialize the app if needed
        const user = session.user
        if (!currentUserId || currentUserId !== user.id) {
          console.log(
            '🔄 [ImportSelectionScreen] Synchronizing store with Supabase user'
          )
          await initializeApp(user.id)
          console.log('✅ [ImportSelectionScreen] Store synchronized', {
            newUserId: user.id,
            storeUpdated: true,
          })
        }
      }

      await initializeAndLoad()
    } catch (err) {
      console.error('Auth check failed:', err)
      const currentUrl = `/import/${token}`
      router.replace(`/(auth)/login?redirect=${encodeURIComponent(currentUrl)}`)
    }
  }, [token, currentUserId, initializeApp])

  useEffect(() => {
    // Set the default target collection when collections are loaded
    if (collections.length > 0 && !targetCollectionId) {
      console.log(
        '✅ [ImportSelectionScreen] Setting default target collection',
        {
          defaultId: collections[0].collection_id,
          defaultName: collections[0].name,
        }
      )
      setTargetCollectionId(collections[0].collection_id)
    }
  }, [collections, targetCollectionId])

  // Recalculate duplicates when words or collections change
  useEffect(() => {
    if (sharedData && wordSelections.length > 0) {
      setWordSelections(prev =>
        prev.map(item => {
          const existingWord = words.find(
            existing =>
              existing.dutch_lemma.toLowerCase() ===
              item.word.dutch_lemma.toLowerCase()
          )

          const isDuplicate = !!existingWord
          let existingInCollection = undefined

          if (existingWord) {
            const collection = collections.find(
              c => c.collection_id === existingWord.collection_id
            )
            existingInCollection = collection?.name || 'Unknown Collection'
          }

          return {
            ...item,
            isDuplicate,
            existingInCollection,
            selected: item.selected && !isDuplicate, // Deselect if it becomes duplicate
          }
        })
      )
    }
  }, [words, collections, sharedData, wordSelections.length])

  const loadSharedCollection = async () => {
    try {
      console.log('🔄 [ImportSelectionScreen] Loading shared collection', {
        token,
      })

      const result =
        await collectionSharingService.getSharedCollectionWords(token)

      if (!result.success) {
        console.log('❌ [ImportSelectionScreen] Failed to load collection', {
          error: result.error,
        })
        setError(getErrorMessage(result.error))
        setLoading(false)
        return
      }

      console.log('✅ [ImportSelectionScreen] Collection loaded', {
        collectionName: result.data.collection.name,
        wordCount: result.data.words.length,
      })

      setSharedData(result.data)

      // Check for duplicates in ALL user's words
      setWordSelections(
        result.data.words.map(word => {
          const existingWord = words.find(
            existing =>
              existing.dutch_lemma.toLowerCase() ===
              word.dutch_lemma.toLowerCase()
          )

          const isDuplicate = !!existingWord
          let existingInCollection = undefined

          if (existingWord) {
            const collection = collections.find(
              c => c.collection_id === existingWord.collection_id
            )
            existingInCollection = collection?.name || 'Unknown Collection'
          }

          return {
            word,
            selected: !isDuplicate, // Don't select duplicates by default
            isDuplicate,
            existingInCollection,
          }
        })
      )
      // Set first collection as default target
      if (collections.length > 0) {
        setTargetCollectionId(collections[0].collection_id)
      }
      setError(null)
    } catch (err) {
      console.error('❌ [ImportSelectionScreen] Unexpected error:', err)
      setError('Failed to load shared collection')
    } finally {
      setLoading(false)
    }
  }

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'COLLECTION_NOT_FOUND':
        return 'This collection is no longer available or the link has expired.'
      case 'COLLECTION_NOT_SHARED':
        return 'This collection is no longer being shared.'
      case 'DATABASE_ERROR':
        return 'Unable to load the collection. Please try again later.'
      default:
        return 'Something went wrong. Please check your connection and try again.'
    }
  }

  const toggleWordSelection = (wordId: string) => {
    setWordSelections(prev =>
      prev.map(item =>
        item.word.word_id === wordId && !item.isDuplicate // Only allow toggle if not duplicate
          ? { ...item, selected: !item.selected }
          : item
      )
    )
  }

  const toggleSelectAll = () => {
    const availableWords = wordSelections.filter(item => !item.isDuplicate)
    const allAvailableSelected = availableWords.every(item => item.selected)

    setWordSelections(prev =>
      prev.map(item =>
        item.isDuplicate
          ? item // Don't change duplicates
          : { ...item, selected: !allAvailableSelected }
      )
    )
  }

  const getSelectedWords = () => {
    return wordSelections.filter(item => item.selected).map(item => item.word)
  }

  const handleImport = async () => {
    const selectedWords = getSelectedWords()

    if (selectedWords.length === 0) {
      ToastService.show(
        'Please select at least one word to import',
        ToastType.INFO
      )
      return
    }

    if (!targetCollectionId) {
      ToastService.show('Please select a target collection', ToastType.ERROR)
      return
    }

    Alert.alert(
      'Import Words',
      `Import ${selectedWords.length} selected word${selectedWords.length === 1 ? '' : 's'} to your collection?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Import',
          onPress: () => performImport(selectedWords),
        },
      ]
    )
  }

  const performImport = async (selectedWords: Word[]) => {
    setImporting(true)
    try {
      console.log('🔄 [ImportSelectionScreen] Starting import', {
        wordCount: selectedWords.length,
        targetCollectionId,
      })

      // Note: Duplicate checking is now done proactively in the UI
      // Users can only select non-duplicate words

      // Transform words for import - remove IDs to create new records
      const wordsToImport = selectedWords.map(word => ({
        dutch_lemma: word.dutch_lemma,
        part_of_speech: word.part_of_speech,
        translations: word.translations,
        examples: word.examples,
        image_url: word.image_url,
        collection_id: targetCollectionId,
      }))

      const success = await addWordsToCollection(
        targetCollectionId,
        wordsToImport
      )

      if (success) {
        ToastService.show(
          `${selectedWords.length} words imported successfully`,
          ToastType.SUCCESS
        )
        console.log('✅ [ImportSelectionScreen] Import completed successfully')

        // Navigate to the main collections screen instead of just going back
        router.replace('/(tabs)/')
      } else {
        ToastService.show('Some words could not be imported', ToastType.ERROR)
      }
    } catch (error) {
      console.error('❌ [ImportSelectionScreen] Import failed:', error)

      // Handle specific error cases
      if (error instanceof Error) {
        if (
          error.message.includes('network') ||
          error.message.includes('fetch')
        ) {
          ToastService.show(
            'Network error. Please check your connection.',
            ToastType.ERROR
          )
        } else if (
          error.message.includes('unauthorized') ||
          error.message.includes('auth')
        ) {
          ToastService.show(
            'Authentication error. Please try again.',
            ToastType.ERROR
          )
        } else {
          ToastService.show(
            'Failed to import words. Please try again.',
            ToastType.ERROR
          )
        }
      } else {
        ToastService.show('An unexpected error occurred', ToastType.ERROR)
      }
    } finally {
      setImporting(false)
    }
  }

  const handleGoBack = () => {
    router.back()
  }

  if (loading) {
    return (
      <SharedCollectionLoadingScreen
        title="Import Words"
        message="Loading words..."
      />
    )
  }

  if (error || !sharedData) {
    return (
      <SharedCollectionErrorScreen
        title="Import Words"
        error={error || 'No data available'}
        onGoBack={handleGoBack}
        showRetry={false}
      />
    )
  }

  const selectedCount = wordSelections.filter(item => item.selected).length
  const duplicateCount = wordSelections.filter(item => item.isDuplicate).length
  const availableWords = wordSelections.filter(item => !item.isDuplicate)
  const allAvailableSelected = availableWords.every(item => item.selected)

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Import Words',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.background.secondary,
          },
          headerLeft: () => (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.replace('/')}
              accessibilityLabel="Cancel import"
              accessibilityHint="Cancel import and go to collections"
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
              style={[
                styles.importButton,
                {
                  opacity: importing || selectedCount === 0 ? 0.6 : 1,
                },
              ]}
              onPress={handleImport}
              disabled={importing || selectedCount === 0}
              accessibilityLabel="Import selected words"
              accessibilityHint={`Import ${selectedCount} selected words to your collection`}
            >
              {importing ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colorScheme === 'dark'
                      ? Colors.dark.tint
                      : Colors.primary.DEFAULT
                  }
                />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={24}
                  color={
                    colorScheme === 'dark'
                      ? Colors.dark.tint
                      : Colors.primary.DEFAULT
                  }
                />
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ViewThemed style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Collection Info Header */}
          <ViewThemed
            style={[
              styles.header,
              {
                borderBottomColor:
                  colorScheme === 'dark'
                    ? Colors.dark.border
                    : Colors.neutral[200],
              },
            ]}
          >
            <TextThemed style={styles.collectionName}>
              {sharedData.collection.name}
            </TextThemed>
            <TextThemed
              style={styles.selectionSummary}
              lightColor={Colors.neutral[600]}
              darkColor={Colors.dark.textSecondary}
            >
              {selectedCount} of {wordSelections.length} words selected
              {duplicateCount > 0 && ` (${duplicateCount} already added)`}
            </TextThemed>
          </ViewThemed>

          {/* Target Collection Selector */}
          <ViewThemed style={styles.targetSection}>
            <TextThemed style={styles.sectionTitle}>
              Import to Collection
            </TextThemed>
            <ImportCollectionSelector
              collections={collections}
              targetCollectionId={targetCollectionId}
              onSelectCollection={setTargetCollectionId}
            />
          </ViewThemed>

          <SelectAllToggle
            allSelected={allAvailableSelected}
            onToggle={toggleSelectAll}
            duplicateCount={duplicateCount}
          />

          <WordSelectionList
            wordSelections={wordSelections}
            onToggleWord={toggleWordSelection}
          />
        </ScrollView>
      </ViewThemed>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  collectionName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectionSummary: {
    fontSize: 14,
  },
  targetSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
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
