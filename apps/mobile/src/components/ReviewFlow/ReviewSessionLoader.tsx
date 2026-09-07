import { useCallback, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { loadNativeReviewSession } from '@/features/review/session'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { Sentry } from '@/lib/sentry'
import { Colors } from '@/constants/Colors'
import { TextThemed, ViewThemed } from '@/components/Themed'
import type { ReviewSession } from '@/types/ReviewTypes'
import { NativeReviewSession } from './NativeReviewSession'
import { ReviewFlowButton } from './ReviewFlowButton'
import { reviewFlowStyles as styles } from './styles'

export function ReviewSessionLoader({
  session,
  userId,
}: {
  session: ReviewSession
  userId: string
}) {
  const [ready, setReady] = useState<ReviewSession | null>(null)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const insets = useSafeAreaInsets()
  useFocusEffect(
    useCallback(() => {
      const abort = new AbortController()
      const manual =
        useSettingsStore.getState().manualRecognitionByUser[userId] ?? false
      void loadNativeReviewSession(
        session,
        userId,
        manual,
        abort.signal,
        count => {
          if (!abort.signal.aborted) setProgress(count)
        }
      )
        .then(controller => {
          if (controller && !abort.signal.aborted) setReady(session)
        })
        .catch(error => {
          if (abort.signal.aborted) return
          setFailed(true)
          Sentry.captureException(error, {
            tags: { operation: 'prepareReviewSession' },
            extra: { attempt },
          })
        })
      return () => abort.abort()
    }, [session, userId, attempt])
  )
  if (ready === session)
    return <NativeReviewSession session={session} userId={userId} />
  const cancel = () => {
    const store = useApplicationStore.getState()
    if (store.currentUserId === userId && store.reviewSession === session)
      store.endReviewSession()
  }
  return (
    <ViewThemed
      testID="screen-review"
      style={[styles.root, styles.scroll, { paddingTop: insets.top }]}
    >
      {failed ? (
        <>
          <TextThemed accessibilityRole="alert">
            Could not prepare review. Your progress has not changed.
          </TextThemed>
          <ReviewFlowButton
            label="Retry preparation"
            onPress={() => {
              setFailed(false)
              setProgress(0)
              setAttempt(value => value + 1)
            }}
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={Colors.primary.DEFAULT} />
          <TextThemed accessibilityLiveRegion="polite">
            Preparing review: {progress} / {session.words.length}
          </TextThemed>
        </>
      )}
      <ReviewFlowButton label="Cancel preparation" onPress={cancel} />
    </ViewThemed>
  )
}
