import { View } from 'react-native'
import {
  getAllowedReviewAssessments,
  revealReviewAnswer,
  skipAssistedReview,
} from '@woordenaar/domain'
import { TextThemed } from '@/components/Themed'
import type {
  NativeReviewController,
  NativeReviewFlow,
} from '@/features/review/controller'
import { ReviewFlowButton } from './ReviewFlowButton'
import { reviewFlowStyles as styles } from './styles'

export function ReviewFlowControls({
  controller,
  flow,
}: {
  controller: NativeReviewController
  flow: NativeReviewFlow
}) {
  const active = flow.active
  if (!active || flow.view.kind === 'history') return null
  if (controller.areWritesBlocked())
    return (
      <TextThemed>
        Resolve the pending correction before answering another word.
      </TextThemed>
    )
  const submission = active.submission
  if (submission?.status === 'saving')
    return (
      <TextThemed accessibilityLiveRegion="polite">
        Saving answer on this device…
      </TextThemed>
    )
  if (submission?.status === 'failed')
    return (
      <View>
        <TextThemed accessibilityRole="alert">{submission.error}</TextThemed>
        <ReviewFlowButton
          label="Retry same answer"
          disabled={!flow.foreground}
          onPress={() => {
            void controller.submit(submission.assessment)
          }}
        />
      </View>
    )
  if (submission?.status === 'saved')
    return (
      <ReviewFlowButton
        label="Continue"
        disabled={!flow.foreground}
        onPress={() => {
          void controller.submit(submission.assessment)
        }}
      />
    )
  const allowed = getAllowedReviewAssessments(flow)
  return (
    <View style={styles.row}>
      {!active.revealed && active.question.mode !== 'recognition' && (
        <ReviewFlowButton
          label="Show Answer"
          testID="reveal-answer-button"
          disabled={!flow.foreground}
          onPress={() =>
            controller.transition(state =>
              revealReviewAnswer(state, active.question.id, Date.now())
            )
          }
        />
      )}
      {allowed.map(assessment => (
        <ReviewFlowButton
          key={assessment}
          label={
            active.answeredCorrectly === false
              ? 'Continue'
              : assessment[0].toUpperCase() + assessment.slice(1)
          }
          testID={`srs-${assessment}-button`}
          onPress={() => {
            void controller.submit(assessment)
          }}
        />
      ))}
      {active.assisted && !submission && (
        <ReviewFlowButton
          label="Skip without rating"
          disabled={!flow.foreground}
          onPress={() =>
            controller.transition(state =>
              skipAssistedReview(state, active.question.id, Date.now())
            )
          }
        />
      )}
    </View>
  )
}
