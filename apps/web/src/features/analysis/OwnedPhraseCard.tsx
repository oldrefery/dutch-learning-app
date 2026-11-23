'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { moveWord } from '@/features/words/actions'
import { INITIAL_WORD_ACTION_STATE } from '@/features/words/form-state'
import type { DuplicateWordResult } from './form-state'

export function OwnedPhraseCard({
  word,
  phrase,
  targetId,
}: {
  word: DuplicateWordResult
  phrase: string
  targetId: string
}) {
  const [state, move, pending] = useActionState(
    moveWord.bind(null, word.collectionId ?? '', word.wordId),
    INITIAL_WORD_ACTION_STATE
  )
  return (
    <section className="dw-surface grid gap-3 p-5">
      <h2>{phrase}</h2>
      <p>
        {word.collectionId === targetId
          ? 'Already in this collection.'
          : `Already in ${word.collectionName ?? 'your vocabulary'}.`}
      </p>
      {word.collectionId && (
        <Link
          className="underline"
          href={`/app/collections/${word.collectionId}/words/${word.wordId}`}
        >
          Open card
        </Link>
      )}
      {word.collectionId && targetId && word.collectionId !== targetId && (
        <form action={move}>
          <input type="hidden" name="targetCollectionId" value={targetId} />
          <Button type="submit" disabled={pending}>
            {pending ? 'Moving…' : 'Move to selected collection'}
          </Button>
          {state.status === 'error' && (
            <p role="alert">
              {state.message ?? state.fieldErrors?.targetCollectionId}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
