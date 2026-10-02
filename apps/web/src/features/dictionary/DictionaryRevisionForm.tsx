'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { INITIAL_WORD_ACTION_STATE } from '@/features/words/form-state'
import { adoptDictionaryRevision } from './actions'
import type { DictionaryCardMetadata } from './content'

export function DictionaryRevisionForm({
  collectionId,
  wordId,
  dictionary,
}: {
  collectionId: string
  wordId: string
  dictionary: DictionaryCardMetadata
}) {
  const [state, action, pending] = useActionState(
    adoptDictionaryRevision.bind(null, collectionId, wordId),
    INITIAL_WORD_ACTION_STATE
  )
  if (!dictionary.availableRevision) return null
  return (
    <form action={action}>
      <p className="dw-support">
        Updated dictionary content is available for this meaning. Your private
        changes and learning progress will be kept.
      </p>
      <input
        type="hidden"
        name="contentVersion"
        value={dictionary.contentVersion}
      />
      <input
        type="hidden"
        name="revisionId"
        value={dictionary.availableRevision.revision_id}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Updating…' : 'Use updated dictionary content'}
      </Button>
      {state.message && (
        <p role={state.status === 'error' ? 'alert' : 'status'}>
          {state.message}
        </p>
      )}
    </form>
  )
}
