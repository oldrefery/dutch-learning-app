import { Button } from '@/components/ui/Button'
import { getReviewIntervalLabel } from './review-domain'
import type { useReviewSession } from './useReviewSession'
import styles from './Review.module.css'

export function ReviewSessionControls({
  session,
}: {
  session: ReturnType<typeof useReviewSession>
}) {
  const active = session.flow?.active
  if (session.historyEntry || !active || session.correction) return null
  const failed = active.submission?.status === 'failed'
  const saved = active.submission?.status === 'saved'
  const againOnly = active.assisted || active.answeredCorrectly === false
  return (
    <div className={styles.continueRow}>
      {active.assisted && (
        <p className="dw-support">
          Answer viewed. Choose Again or skip without changing progress.
        </p>
      )}
      {session.error && (
        <p role="alert" className={styles.error}>
          {session.error}
        </p>
      )}
      {session.pending && <p role="status">Saving…</p>}
      {saved && (
        <Button type="button" onClick={() => void session.submit('good')}>
          Continue
        </Button>
      )}
      {!saved &&
        !session.pending &&
        session.allowedAssessments.map(assessment => (
          <Button
            key={assessment}
            type="button"
            variant={
              assessment === 'good' || againOnly ? 'primary' : 'secondary'
            }
            onClick={() => void session.submit(assessment)}
          >
            {failed ? 'Retry ' : againOnly ? 'Continue · ' : ''}
            {assessment[0].toUpperCase() + assessment.slice(1)}
            {!failed && !againOnly && (
              <small>
                {' '}
                ·{' '}
                {getReviewIntervalLabel(
                  active.question.payload.word,
                  assessment
                )}
              </small>
            )}
          </Button>
        ))}
      {active.assisted && !active.submission && (
        <Button type="button" variant="secondary" onClick={session.skip}>
          Skip without review
        </Button>
      )}
    </div>
  )
}
