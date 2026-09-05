import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ToastService } from '@/components/AppToast'
import WordDetailModal from '@/components/WordDetailModal'
import {
  DifficultWordRow,
  ReviewInsightsEmptyState,
  ReviewInsightsSummary,
} from '@/components/ReviewInsights'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { REVIEW_SCOPE } from '@/constants/ReviewConstants'
import { ROUTES } from '@/constants/Routes'
import { ToastType } from '@/constants/ToastConstants'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import type { Word } from '@/types/database'
import { buildReviewInsights } from '@/utils/reviewInsights'

export default function InsightsScreen() {
  const insets = useSafeAreaInsets()
  const colorScheme = useNormalizedColorScheme()
  const words = useApplicationStore(state => state.words)
  const wordsLoading = useApplicationStore(state => state.wordsLoading)
  const reviewLoading = useApplicationStore(state => state.reviewLoading)
  const currentUserId = useApplicationStore(state => state.currentUserId)
  const error = useApplicationStore(state => state.error)
  const fetchWords = useApplicationStore(state => state.fetchWords)
  const clearError = useApplicationStore(state => state.clearError)
  const startReviewSession = useApplicationStore(
    state => state.startReviewSession
  )
  const lastSelectedReviewMode = useSettingsStore(
    state => state.lastSelectedReviewMode
  )
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const userWords = useMemo(
    () =>
      currentUserId ? words.filter(word => word.user_id === currentUserId) : [],
    [currentUserId, words]
  )
  const insights = useMemo(() => buildReviewInsights(userWords), [userWords])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshError(null)
    clearError()
    try {
      await fetchWords()

      const nextError = useApplicationStore.getState().error
      if (nextError) {
        setRefreshError(nextError.message)
      }
    } finally {
      setRefreshing(false)
    }
  }, [clearError, fetchWords])

  const handleStartDifficultReview = useCallback(async () => {
    await startReviewSession({
      mode: lastSelectedReviewMode,
      scope: REVIEW_SCOPE.DIFFICULT_DUE,
    })

    const state = useApplicationStore.getState()
    if (state.reviewSession?.config.scope === REVIEW_SCOPE.DIFFICULT_DUE) {
      router.push(ROUTES.TABS.REVIEW)
      return
    }

    ToastService.show(
      'No difficult words are due for review right now.',
      ToastType.INFO
    )
  }, [lastSelectedReviewMode, startReviewSession])

  if (wordsLoading && userWords.length === 0) {
    return (
      <ViewThemed style={styles.centered} testID="review-insights-loading">
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <TextThemed
          style={styles.loadingText}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          Loading review insights…
        </TextThemed>
      </ViewThemed>
    )
  }

  if (userWords.length === 0) {
    return (
      <ReviewInsightsEmptyState
        onRefresh={handleRefresh}
        errorMessage={refreshError ?? error?.message ?? null}
      />
    )
  }

  return (
    <ViewThemed style={styles.container} testID="screen-review-insights">
      <FlatList
        data={insights.difficultWords}
        keyExtractor={word => word.word_id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary.DEFAULT]}
            tintColor={Colors[colorScheme].tint}
          />
        }
        ListHeaderComponent={
          <ReviewInsightsSummary
            insights={insights}
            isStartingReview={reviewLoading}
            onStartDifficultReview={handleStartDifficultReview}
            staleMessage={refreshError}
          />
        }
        renderItem={({ item }) => (
          <DifficultWordRow word={item} onPress={() => setSelectedWord(item)} />
        )}
      />
      {selectedWord && (
        <WordDetailModal
          visible
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 12,
  },
})
