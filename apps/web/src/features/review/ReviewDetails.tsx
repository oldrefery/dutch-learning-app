'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import { loadReviewWordDetails } from './details-action'

/** Mounted with an account/word key; stale responses cannot replace another card. */
export function ReviewDetails({
  userId,
  wordId,
}: {
  userId: string
  wordId: string
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof loadReviewWordDetails>
  > | null>(null)
  const [attempt, setAttempt] = useState(0)
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
  return <WordDetailCard word={result.word} />
}
