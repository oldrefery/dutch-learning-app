import { Button } from '@/components/ui/Button'
import type { useReviewSession } from './useReviewSession'
import styles from './Review.module.css'

export function ReviewSessionNavigation({
  session,
}: {
  session: ReturnType<typeof useReviewSession>
}) {
  const flow = session.flow
  if (!flow) return null
  const inHistory = flow.view.kind === 'history'
  return (
    <nav aria-label="Session history" className={styles.continueRow}>
      <Button
        type="button"
        variant="secondary"
        disabled={
          !flow.history.length ||
          (inHistory && flow.view.kind === 'history' && flow.view.index === 0)
        }
        onClick={() => session.goTo(-1)}
      >
        Previous word
      </Button>
      {flow.history.length > 0 && (
        <select
          className="dw-field"
          aria-label="Reviewed word"
          value={flow.view.kind === 'history' ? String(flow.view.index) : ''}
          onChange={event =>
            event.target.value === ''
              ? session.returnToCurrent()
              : session.browseHistory(Number(event.target.value))
          }
        >
          <option value="">
            {flow.active ? 'Current question' : 'Session summary'}
          </option>
          {flow.history.map((entry, index) => (
            <option key={entry.question.question.id} value={index}>
              {index + 1}. {entry.question.question.payload.word.dutchLemma} ·{' '}
              {entry.result.kind === 'assessed'
                ? entry.result.assessment
                : 'skipped'}
            </option>
          ))}
        </select>
      )}
      {inHistory && (
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => session.goTo(1)}
          >
            Next reviewed word
          </Button>
          <Button type="button" onClick={session.returnToCurrent}>
            {flow.active ? 'Return to current question' : 'Return to summary'}
          </Button>
        </>
      )}
      {session.currentWord && (
        <Button
          type="button"
          variant="secondary"
          onClick={
            session.detailsVisible ? session.closeDetails : session.openDetails
          }
        >
          {session.detailsVisible ? 'Back to question' : 'Full details'}
        </Button>
      )}
    </nav>
  )
}
