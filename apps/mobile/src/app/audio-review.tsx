import React, { useCallback, useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import { useAudioReviewSession } from '@/hooks/useAudioReviewSession'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface AudioReviewButtonProps {
  testID: string
  label: string
  hint: string
  disabled?: boolean
  compact?: boolean
  emphasis?: 'primary' | 'secondary' | 'danger'
  onPress: () => void
}

const DOUBLE_TAP_DELAY_MS = 400

function usePromptTapHandler(
  onSingleTap: () => Promise<void>,
  onDoubleTap: () => Promise<void>
) {
  const pendingSingleTapRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (pendingSingleTapRef.current) {
        clearTimeout(pendingSingleTapRef.current)
      }
    },
    []
  )

  return useCallback(() => {
    if (pendingSingleTapRef.current) {
      clearTimeout(pendingSingleTapRef.current)
      pendingSingleTapRef.current = null
      void onDoubleTap()
      return
    }

    pendingSingleTapRef.current = setTimeout(() => {
      pendingSingleTapRef.current = null
      void onSingleTap()
    }, DOUBLE_TAP_DELAY_MS)
  }, [onDoubleTap, onSingleTap])
}

function AudioReviewButton({
  testID,
  label,
  hint,
  disabled = false,
  compact = false,
  emphasis = 'secondary',
  onPress,
}: AudioReviewButtonProps) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]
  const backgroundColor =
    emphasis === 'primary'
      ? theme.tint
      : emphasis === 'danger'
        ? Colors.error.DEFAULT
        : theme.backgroundSecondary
  const borderColor =
    emphasis === 'secondary' ? theme.border : Colors.transparent.clear

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.button,
        compact && styles.compactButton,
        { backgroundColor, borderColor, opacity: disabled ? 0.45 : 1 },
      ]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
    >
      <TextThemed
        style={styles.buttonText}
        lightColor={
          emphasis === 'secondary' ? Colors.light.text : Colors.legacy.white
        }
        darkColor={Colors.dark.text}
      >
        {label}
      </TextThemed>
    </TouchableOpacity>
  )
}

const getEmptyStateCopy = (sessionComplete: boolean) =>
  sessionComplete
    ? {
        title: 'Audio Review Complete',
        message: 'Your answers were saved with the standard SRS schedule.',
      }
    : {
        title: 'Nothing Due',
        message: 'There are no due words available for Audio Review.',
      }

const getPromptAccessibilityLabel = (
  isRevealed: boolean,
  dutchLemma: string,
  preferredTranslation: string | null
) =>
  isRevealed
    ? `Answer: ${preferredTranslation ?? 'Translation unavailable'}`
    : `Dutch prompt: ${dutchLemma}`

const getListeningStatus = (isPaused: boolean, isPlaying: boolean) => {
  if (isPaused) return 'Playback paused'
  if (isPlaying) return 'Playing Dutch prompt…'
  return 'Listen, recall, then reveal'
}

interface AudioReviewAssessmentControlsProps {
  isRevealed: boolean
  isAssessing: boolean
  onReveal: () => Promise<void>
  onAgain: () => Promise<void>
  onGood: () => Promise<void>
}

function AudioReviewAssessmentControls({
  isRevealed,
  isAssessing,
  onReveal,
  onAgain,
  onGood,
}: AudioReviewAssessmentControlsProps) {
  if (!isRevealed) {
    return (
      <AudioReviewButton
        testID="audio-review-reveal-button"
        label="Show Answer"
        hint="Reveals the translation and repeats the Dutch pronunciation"
        emphasis="primary"
        onPress={() => void onReveal()}
      />
    )
  }

  return (
    <>
      <AudioReviewButton
        testID="audio-review-again-button"
        label="Again"
        hint="Schedules the word for another attempt"
        disabled={isAssessing}
        emphasis="danger"
        onPress={() => void onAgain()}
      />
      <AudioReviewButton
        testID="audio-review-good-button"
        label="Good"
        hint="Records a successful recall and continues"
        disabled={isAssessing}
        emphasis="primary"
        onPress={() => void onGood()}
      />
    </>
  )
}

export default function AudioReviewScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]
  const session = useAudioReviewSession()
  const { exitSession, replayPrompt, revealAnswer } = session
  const handlePromptTouchEnd = usePromptTapHandler(revealAnswer, replayPrompt)

  const handleExit = useCallback(async () => {
    await exitSession()
    router.replace(ROUTES.TABS.REVIEW)
  }, [exitSession, router])

  if (session.isStarting) {
    return (
      <ViewThemed
        testID="screen-audio-review"
        style={[styles.screen, styles.centered]}
      >
        <ActivityIndicator size="large" color={theme.tint} />
        <TextThemed style={styles.statusText}>
          Preparing Audio Review…
        </TextThemed>
      </ViewThemed>
    )
  }

  if (session.sessionEmpty || session.sessionComplete || !session.currentWord) {
    const emptyCopy = getEmptyStateCopy(session.sessionComplete)

    return (
      <ViewThemed
        testID="screen-audio-review"
        style={[
          styles.screen,
          styles.centered,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <TextThemed style={styles.title}>{emptyCopy.title}</TextThemed>
        <TextThemed
          style={styles.emptyText}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          {emptyCopy.message}
        </TextThemed>
        <AudioReviewButton
          testID="exit-audio-review-button"
          label="Exit Audio Review"
          hint="Returns to review mode selection"
          emphasis="primary"
          onPress={() => void handleExit()}
        />
      </ViewThemed>
    )
  }

  return (
    <ViewThemed
      testID="screen-audio-review"
      style={[
        styles.screen,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.header}>
        <View>
          <TextThemed style={styles.eyebrow}>AUDIO REVIEW</TextThemed>
          <TextThemed style={styles.progress}>
            {session.currentWordNumber} / {session.totalWords}
          </TextThemed>
        </View>
        <AudioReviewButton
          testID="exit-audio-review-button"
          label="Exit"
          hint="Stops audio and returns to review mode selection"
          compact
          emphasis="danger"
          onPress={() => void handleExit()}
        />
      </View>

      <Pressable
        testID="audio-review-tap-surface"
        style={[
          styles.promptSurface,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
          },
        ]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={getPromptAccessibilityLabel(
          session.isRevealed,
          session.currentWord.dutch_lemma,
          session.preferredTranslation
        )}
        accessibilityHint="Single tap reveals the answer. Double tap replays the Dutch pronunciation."
        accessibilityActions={[{ name: 'activate', label: 'Reveal answer' }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'activate') {
            void revealAnswer()
          }
        }}
        onTouchEnd={handlePromptTouchEnd}
      >
        <TextThemed
          style={styles.gestureHint}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          {session.isRevealed
            ? 'Double tap to replay Dutch'
            : 'Tap to reveal · Double tap to replay'}
        </TextThemed>
        <TextThemed style={styles.promptWord}>
          {session.currentWord.dutch_lemma}
        </TextThemed>
        {session.isRevealed ? (
          <TextThemed
            testID="audio-review-answer"
            style={styles.answer}
            lightColor={Colors.neutral[700]}
            darkColor={Colors.dark.textSecondary}
            accessibilityRole="text"
          >
            {session.preferredTranslation ?? 'Translation unavailable'}
          </TextThemed>
        ) : (
          <TextThemed
            style={styles.listeningStatus}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            {getListeningStatus(session.isPaused, session.isPlaying)}
          </TextThemed>
        )}
      </Pressable>

      <View style={styles.playbackControls}>
        <AudioReviewButton
          testID="audio-review-replay-button"
          label="Replay"
          hint="Replays the current Dutch pronunciation"
          onPress={() => void replayPrompt()}
        />
        <AudioReviewButton
          testID="audio-review-pause-button"
          label={session.isPaused ? 'Resume' : 'Pause'}
          hint={
            session.isPaused
              ? 'Resumes the current pronunciation'
              : 'Pauses the current pronunciation'
          }
          onPress={session.togglePause}
        />
      </View>

      <View style={styles.assessmentControls}>
        <AudioReviewAssessmentControls
          isRevealed={session.isRevealed}
          isAssessing={session.isAssessing}
          onReveal={revealAnswer}
          onAgain={session.submitAgain}
          onGood={session.submitGood}
        />
      </View>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  progress: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  promptSurface: {
    flex: 1,
    minHeight: 280,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  gestureHint: {
    position: 'absolute',
    top: 24,
    fontSize: 13,
    textAlign: 'center',
  },
  promptWord: {
    fontSize: 38,
    fontWeight: '700',
    lineHeight: 46,
    textAlign: 'center',
  },
  answer: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    marginTop: 24,
    textAlign: 'center',
  },
  listeningStatus: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 24,
    textAlign: 'center',
  },
  playbackControls: {
    flexDirection: 'row',
    gap: 12,
  },
  assessmentControls: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  compactButton: {
    flex: 0,
    minWidth: 88,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 17,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 25,
    marginVertical: 20,
    textAlign: 'center',
  },
})
