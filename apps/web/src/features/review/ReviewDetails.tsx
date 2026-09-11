'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import { reanalyzeWord } from '@/features/words/actions'
import { INITIAL_WORD_ACTION_STATE } from '@/features/words/form-state'
import { loadReviewWordDetails } from './details-action'

/** Mounted with an account/word key; stale responses cannot replace another card. */
export function ReviewDetails({
  canUseAi = false,
  userId,
  wordId,
}: {
  canUseAi?: boolean
  userId: string
  wordId: string
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof loadReviewWordDetails>
  > | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [reanalysisMessage, setReanalysisMessage] = useState<{
    status: 'success' | 'error'
    text: string
  } | null>(null)
  const [isReanalyzing, startReanalysis] = useTransition()

  useEffect(() => {
    let cancelled = false
    void loadReviewWordDetails({ userId, wordId })
      .then(value => {
        if (!cancelled) setResult(value)
      })
      .catch(() => {
        if (!cancelled)
          setResult({
            status: 'error',
            message: 'Could not load the full card. Please try again.',
          })
      })
    return () => {
      cancelled = true
    }
  }, [userId, wordId, attempt])
  if (!result) return <p role="status">Loading full card…</p>
  if (result.status === 'error')
    return (
      <div>
        <p role="alert">{result.message}</p>
        <Button
          type="button"
          onClick={() => {
            setResult(null)
            setAttempt(value => value + 1)
          }}
        >
          Retry full details
        </Button>
      </div>
    )
  const collectionId = result.word.collectionId
  const handleReanalyze = () => {
    if (!collectionId) return

    setReanalysisMessage(null)
    startReanalysis(async () => {
      try {
        const state = await reanalyzeWord(
          collectionId,
          wordId,
          INITIAL_WORD_ACTION_STATE,
          new FormData()
        )
        if (state.status !== 'success') {
          setReanalysisMessage({
            status: 'error',
            text: state.message ?? 'Could not reanalyze this word.',
          })
          return
        }

        setReanalysisMessage({
          status: 'success',
          text: state.message ?? 'Fresh analysis saved.',
        })
        setResult(null)
        setAttempt(value => value + 1)
      } catch {
        setReanalysisMessage({
          status: 'error',
          text: 'Could not reanalyze this word. Please try again.',
        })
      }
    })
  }

  return (
    <div>
      <WordDetailCard word={result.word} />
      {canUseAi && collectionId && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <Button
            disabled={isReanalyzing}
            onClick={handleReanalyze}
            type="button"
            variant="secondary"
          >
            {isReanalyzing ? 'Reanalyzing…' : 'Reanalyze with AI'}
          </Button>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Refresh linguistic data without changing learning progress.
          </span>
        </div>
      )}
      {reanalysisMessage && (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${
            reanalysisMessage.status === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
          role={reanalysisMessage.status === 'error' ? 'alert' : 'status'}
        >
          {reanalysisMessage.text}
        </p>
      )}
    </div>
  )
}
