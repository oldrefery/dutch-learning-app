import { useSyncExternalStore } from 'react'
import { View } from 'react-native'
import type {
  NativeReviewController,
  NativeReviewFlow,
} from '@/features/review/controller'
import { TextThemed } from '@/components/Themed'
import { ReviewFlowButton } from './ReviewFlowButton'
import { reviewFlowStyles as styles } from './styles'

export function ReviewCorrectionControls({
  controller,
  flow,
}: {
  controller: NativeReviewController
  flow: NativeReviewFlow
}) {
  const corrections = controller.corrections
  const state = useSyncExternalStore(
    corrections.subscribe,
    corrections.getSnapshot,
    corrections.getSnapshot
  )
  const entry =
    flow.view.kind === 'history' ? flow.history[flow.view.index] : null
  if (state.status === 'unavailable')
    return entry ? (
      <TextThemed>
        Assessment changes are not available in this build yet.
      </TextThemed>
    ) : null
  const editable =
    entry?.result.kind === 'assessed' &&
    !entry.question.assisted &&
    !state.lockedEvents.includes(entry.result.eventId)
  const assessmentBusy =
    flow.active?.submission?.status === 'saving' ||
    flow.active?.submission?.status === 'failed'
  return (
    <View style={styles.row}>
      {state.notice && (
        <TextThemed accessibilityLiveRegion="polite">{state.notice}</TextThemed>
      )}
      {state.status === 'checking' && (
        <TextThemed>Checking unfinished assessment changes…</TextThemed>
      )}
      {(state.status === 'retry' || state.status === 'loadFailed') && (
        <ReviewFlowButton
          label={
            state.status === 'loadFailed'
              ? 'Retry loading corrections'
              : 'Retry same correction'
          }
          disabled={!flow.foreground}
          onPress={() => {
            void corrections.retry()
          }}
        />
      )}
      {state.status === 'conflict' && (
        <ReviewFlowButton
          label="Keep server version"
          disabled={!flow.foreground}
          onPress={() => {
            void corrections.keepServer()
          }}
        />
      )}
      {state.status === 'retry' && corrections.canCancelUnqueued && (
        <ReviewFlowButton
          label="Cancel if not saved"
          disabled={!flow.foreground}
          onPress={() => {
            void corrections.cancelUnqueued()
          }}
        />
      )}
      {editable &&
        state.status === 'idle' &&
        (['again', 'hard', 'good', 'easy'] as const).map(assessment => (
          <ReviewFlowButton
            key={assessment}
            label={`Change to ${assessment}`}
            disabled={
              !flow.foreground ||
              assessmentBusy ||
              entry.result.kind !== 'assessed' ||
              entry.result.assessment === assessment
            }
            onPress={() => {
              void corrections.change(assessment)
            }}
          />
        ))}
    </View>
  )
}
