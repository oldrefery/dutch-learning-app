import { useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { ReviewModeSelector } from '@/components/ReviewModeSelector'
import { NativeReviewSession } from '@/components/ReviewFlow/NativeReviewSession'
import { ManualRecognitionPreference } from '@/components/ReviewFlow/ManualRecognitionPreference'
import { ReviewFlowButton } from '@/components/ReviewFlow/ReviewFlowButton'
import { reviewFlowStyles as styles } from '@/components/ReviewFlow/styles'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { ROUTES } from '@/constants/Routes'
import { Colors } from '@/constants/Colors'
import type { ReviewSessionMode } from '@/types/ReviewTypes'
import {
  LEARNING_GUIDE_VERSION,
  shouldShowLearningGuideIntroduction,
} from '@/components/LearningGuide'

export default function ReviewScreen() {
  const session = useApplicationStore(state => state.reviewSession)
  const userId = useApplicationStore(state => state.currentUserId)
  const loading = useApplicationStore(state => state.reviewLoading)
  const hydrated = useSyncExternalStore(
    useSettingsStore.persist.onFinishHydration,
    useSettingsStore.persist.hasHydrated,
    () => false
  )
  if (!hydrated)
    return (
      <ViewThemed testID="screen-review" style={styles.root}>
        <ActivityIndicator
          color={Colors.primary.DEFAULT}
          accessibilityLabel="Loading review session"
        />
      </ViewThemed>
    )
  if (!userId)
    return (
      <ViewThemed>
        <TextThemed>Sign in to review your words.</TextThemed>
      </ViewThemed>
    )
  if (session)
    return (
      <NativeReviewSession key={userId} session={session} userId={userId} />
    )
  return <ReviewSetup userId={userId} loading={loading} />
}

function ReviewSetup({
  userId,
  loading,
}: {
  userId: string
  loading: boolean
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const mode = useSettingsStore(state => state.lastSelectedReviewMode)
  const adaptive = useSettingsStore(state => state.adaptiveReviewEnabled)
  const guideVersion = useSettingsStore(state => state.learningGuideVersionSeen)
  const setMode = useSettingsStore(state => state.setLastSelectedReviewMode)
  const markGuide = useSettingsStore(
    state => state.markLearningGuideVersionSeen
  )
  const [message, setMessage] = useState<string | null>(null)
  const start = async (selected: ReviewSessionMode) => {
    setMode(selected)
    await useApplicationStore
      .getState()
      .startReviewSession({ mode: selected, scope: 'all-due' })
    const state = useApplicationStore.getState()
    if (state.currentUserId !== userId) return
    if (!state.reviewSession)
      setMessage(
        state.error
          ? 'Could not start review. Please try again.'
          : 'No words to review! All your words are scheduled for later.'
      )
  }
  if (loading)
    return (
      <ActivityIndicator
        color={Colors.primary.DEFAULT}
        accessibilityLabel="Loading review session"
      />
    )
  return (
    <ViewThemed
      testID="screen-review"
      style={[styles.root, { paddingTop: insets.top }]}
    >
      {message ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TextThemed accessibilityRole="alert">{message}</TextThemed>
          <ReviewFlowButton
            label="Try again"
            onPress={() => {
              void start(mode)
            }}
          />
          <ReviewFlowButton
            label="Choose another mode"
            onPress={() => setMessage(null)}
          />
        </ScrollView>
      ) : (
        <>
          <ManualRecognitionPreference userId={userId} />
          <ReviewModeSelector
            selectedMode={mode}
            onSelectMode={setMode}
            onStart={start}
            adaptiveEnabled={adaptive}
            onStartAudioReview={() => router.push(ROUTES.AUDIO_REVIEW)}
            showLearningGuideIntro={shouldShowLearningGuideIntroduction(
              guideVersion
            )}
            onOpenLearningGuide={() =>
              router.push(ROUTES.LEARNING_GUIDE as Href)
            }
            onDismissLearningGuideIntro={() =>
              markGuide(LEARNING_GUIDE_VERSION)
            }
          />
        </>
      )}
    </ViewThemed>
  )
}
