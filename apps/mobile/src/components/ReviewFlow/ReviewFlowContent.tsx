import { Pressable } from 'react-native'
import { revealReviewAnswer } from '@woordenaar/domain'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { UniversalWordCard } from '@/components/UniversalWordCard'
import { RecognitionCard } from '@/components/ReviewModes/RecognitionCard'
import { MeaningRecallCard } from '@/components/ReviewModes/MeaningRecallCard'
import { DutchProductionCard } from '@/components/ReviewModes/DutchProductionCard'
import { Colors } from '@/constants/Colors'
import type {
  NativeReviewController,
  NativeReviewFlow,
} from '@/features/review/controller'
import { reviewFlowStyles as styles } from './styles'

const fullCardConfig = { scrollable: false, enableImageChange: false }
export function ReviewFlowContent({
  flow,
  controller,
  playAudio,
  isPlaying,
}: {
  flow: NativeReviewFlow
  controller: NativeReviewController
  playAudio: (url?: string) => void
  isPlaying: boolean
}) {
  const history =
    flow.view.kind === 'history' ? flow.history[flow.view.index] : null
  const active = history?.question ?? flow.active
  if (!active) return null
  const question = active.question
  const { word, translation, explanation } = question.payload
  const details =
    flow.view.kind === 'details' ||
    (flow.view.kind === 'history' && flow.view.details) ||
    (question.mode !== 'recognition' && active.revealed)
  return (
    <>
      {explanation && (
        <TextThemed style={styles.note}>{explanation}</TextThemed>
      )}
      {history && (
        <TextThemed accessibilityLiveRegion="polite">
          {history.result.kind === 'skipped'
            ? 'Skipped without rating'
            : `Recorded: ${history.result.assessment}`}
        </TextThemed>
      )}
      {active.answeredCorrectly === true && (
        <ViewThemed
          style={[styles.feedback, { borderColor: Colors.success.DEFAULT }]}
        >
          <TextThemed accessibilityLiveRegion="polite">
            ✓ Correct
            {!history &&
              (active.manualRecognition
                ? ' — choose a rating below.'
                : ' — Good by default.')}
          </TextThemed>
        </ViewThemed>
      )}
      {active.answeredCorrectly === false && (
        <TextThemed accessibilityRole="alert">
          {history
            ? 'Incorrect answer'
            : 'Incorrect — read the card, then Continue to record Again.'}
        </TextThemed>
      )}
      {active.assisted && (
        <TextThemed accessibilityRole="alert">
          Answer viewed before responding.
          {!history && ' Choose Again or skip without rating.'}
        </TextThemed>
      )}
      {details ? (
        <UniversalWordCard
          word={word}
          config={fullCardConfig}
          isPlayingAudio={isPlaying}
          onPlayPronunciation={playAudio}
        />
      ) : question.mode === 'recognition' ? (
        <RecognitionCard
          word={word}
          options={[...question.options]}
          selectedOptionId={active.selectedOptionId}
          isPlayingAudio={isPlaying}
          onPlayPronunciation={playAudio}
          disabled={
            controller.areWritesBlocked() ||
            Boolean(history) ||
            !flow.foreground ||
            active.answeredAt !== null ||
            active.assisted
          }
          onSelectOption={option => controller.selectOption(option.id)}
        />
      ) : question.mode === 'dutch-production' ? (
        <DutchProductionCard prompt={translation ?? ''} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reveal meaning"
          disabled={Boolean(history) || !flow.foreground}
          onPress={() =>
            controller.transition(state =>
              revealReviewAnswer(state, question.id, Date.now())
            )
          }
        >
          <MeaningRecallCard
            word={word}
            isPlayingAudio={isPlaying}
            onPlayPronunciation={playAudio}
          />
        </Pressable>
      )}
    </>
  )
}
