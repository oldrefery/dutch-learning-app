import { Button } from '@/components/ui/Button'
import type { ReviewAssessment } from './types'
import type { useReviewSession } from './useReviewSession'
import styles from './Review.module.css'

export function ReviewCorrectionControls({
  session,
}: {
  session: ReturnType<typeof useReviewSession>
}) {
  const command = session.correction
  if (command)
    return (
      <section
        aria-label="Pending assessment correction"
        className={styles.correctionPanel}
      >
        <p
          role={
            command.status === 'saving' || command.status === 'refreshing'
              ? 'status'
              : 'alert'
          }
        >
          Requested assessment: {command.input.assessment}. {command.message}
        </p>
        <p className="dw-support">
          You can browse cards. Resolve this edit before saving another answer
          or restarting the session.
        </p>
        {command.status === 'retry' && (
          <Button type="button" onClick={() => void session.retryCorrection()}>
            Retry same correction
          </Button>
        )}
        {['conflict', 'invalid', 'unavailable'].includes(command.status) && (
          <Button
            type="button"
            onClick={() => void session.keepServerVersion()}
          >
            Keep server version
          </Button>
        )}
      </section>
    )
  const entry = session.historyEntry
  return (
    <>
      {session.notice && <p role="status">{session.notice}</p>}
      {entry?.result.kind === 'assessed' && (
        <section
          aria-label="Change saved assessment"
          className={styles.correctionPanel}
        >
          {!session.correctionsAvailable ? (
            <p className="dw-support">
              Assessment corrections are not available on this server yet.
            </p>
          ) : entry.question.assisted ? (
            <p className="dw-support">
              This answer was viewed before responding. Review it independently
              to improve its assessment.
            </p>
          ) : session.blockedCorrections.includes(entry.result.eventId) ? (
            <p className="dw-support">
              This review can no longer be edited in this session.
            </p>
          ) : (
            <>
              <p>
                Change assessment · This replaces the saved rating, without
                adding a review.
              </p>
              <div className={styles.continueRow}>
                {(['again', 'hard', 'good', 'easy'] as ReviewAssessment[]).map(
                  assessment => (
                    <Button
                      key={assessment}
                      type="button"
                      variant="secondary"
                      disabled={
                        session.unsettled ||
                        (entry.result.kind === 'assessed' &&
                          assessment === entry.result.assessment)
                      }
                      onClick={() => void session.correct(assessment)}
                    >
                      Change to{' '}
                      {assessment[0].toUpperCase() + assessment.slice(1)}
                    </Button>
                  )
                )}
              </div>
            </>
          )}
        </section>
      )}
    </>
  )
}
