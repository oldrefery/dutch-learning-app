import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { ScrollView } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  browseReviewHistory,
  previousReviewWord,
  returnToReviewQuestion,
  openReviewDetails,
  closeReviewDetails,
  setReviewManualRecognition,
  summarizeReviewFlow,
} from '@woordenaar/domain'
import type { ReviewSession } from '@/types/ReviewTypes'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { getNativeReviewSession } from '@/features/review/session'
import { attachNativeReviewLifecycle } from '@/features/review/lifecycle'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { ManualRecognitionPreference } from './ManualRecognitionPreference'
import { ReviewFlowButton } from './ReviewFlowButton'
import { ReviewFlowContent } from './ReviewFlowContent'
import { ReviewFlowControls } from './ReviewFlowControls'
import { ReviewCorrectionControls } from './ReviewCorrectionControls'
import { reviewFlowStyles as styles } from './styles'

export function NativeReviewSession({
  session,
  userId,
}: {
  session: ReviewSession
  userId: string
}) {
  const manual = useSettingsStore(
    state => state.manualRecognitionByUser[userId] === true
  )
  const controller = useMemo(
    () => getNativeReviewSession(session, userId, manual),
    [session, userId, manual]
  )
  const flow = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  )
  const insets = useSafeAreaInsets()
  const scroll = useRef<ScrollView>(null)
  const { playAudio, isPlaying } = useAudioPlayer()
  useFocusEffect(
    useCallback(() => attachNativeReviewLifecycle(controller), [controller])
  )
  useEffect(() => {
    controller.transition(state => setReviewManualRecognition(state, manual))
  }, [controller, manual])
  const historyIndex = flow.view.kind === 'history' ? flow.view.index : null
  const displayed =
    historyIndex === null ? flow.active : flow.history[historyIndex].question
  const displayedId = displayed?.question.id
  const viewKind = flow.view.kind
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false })
  }, [displayedId, viewKind])
  const play = useCallback(
    (url?: string) => {
      const word = displayed?.question.payload.word
      if (word) void playAudio(url, word.dutch_lemma, word.tts_url)
    },
    [displayed, playAudio]
  )
  const summary = summarizeReviewFlow(flow)
  const busy =
    controller.areWritesBlocked() ||
    flow.active?.submission?.status === 'saving' ||
    flow.active?.submission?.status === 'failed'
  const exit = () => {
    if (
      controller.exit() &&
      useApplicationStore.getState().currentUserId === userId
    ) {
      useApplicationStore.getState().endReviewSession()
    }
  }
  const showingDetails =
    flow.view.kind === 'details' ||
    (flow.view.kind === 'history' && flow.view.details)
  return (
    <ViewThemed
      testID="screen-review"
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <TextThemed style={styles.title} accessibilityLiveRegion="polite">
          {historyIndex !== null
            ? `History ${historyIndex + 1} / ${flow.history.length}`
            : summary.finished
              ? 'Session Complete!'
              : `Word ${flow.history.length + 1} / ${session.words.length}`}
        </TextThemed>
        <TextThemed>
          {summary.assessed} reviewed · {summary.skipped} skipped
        </TextThemed>
        <ViewThemed style={styles.row}>
          <ReviewFlowButton
            label="Previous word"
            disabled={!flow.history.length || historyIndex === 0}
            onPress={() => controller.transition(previousReviewWord)}
          />
          {historyIndex !== null && (
            <>
              <ReviewFlowButton
                label="Next reviewed word"
                disabled={historyIndex >= flow.history.length - 1}
                onPress={() =>
                  controller.transition(state =>
                    browseReviewHistory(state, historyIndex + 1)
                  )
                }
              />
              <ReviewFlowButton
                label={
                  flow.active ? 'Return to current question' : 'Back to summary'
                }
                onPress={() => controller.transition(returnToReviewQuestion)}
              />
            </>
          )}
          {displayed && (
            <ReviewFlowButton
              label={showingDetails ? 'Back to question' : 'Full details'}
              onPress={() =>
                controller.transition(
                  showingDetails ? closeReviewDetails : openReviewDetails
                )
              }
            />
          )}
        </ViewThemed>
        <ReviewFlowContent
          flow={flow}
          controller={controller}
          playAudio={play}
          isPlaying={isPlaying}
        />
        <ReviewFlowControls flow={flow} controller={controller} />
        <ReviewCorrectionControls flow={flow} controller={controller} />
        {summary.finished && historyIndex === null && (
          <TextThemed>
            Again {summary.counts.again} · Hard {summary.counts.hard} · Good{' '}
            {summary.counts.good} · Easy {summary.counts.easy}
          </TextThemed>
        )}
        <ManualRecognitionPreference userId={userId} duringSession />
        <ReviewFlowButton
          label={summary.finished ? 'Choose another mode' : 'Finish session'}
          disabled={busy}
          onPress={exit}
        />
      </ScrollView>
    </ViewThemed>
  )
}
