'use client'

import { useRef, useState } from 'react'
import type {
  DictionaryCollectionExportV2,
  FollowingImportOperation,
} from '@woordenaar/domain'
import { Button } from '@/components/ui/Button'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import {
  isLinkedWordImportEnabled,
  savePublishedWord,
} from './save-published-word'
import { buildWordDetail } from '@/features/words/word-detail'
import { projectDictionaryContent } from '@/features/dictionary/content'

export function PublishedWordReview({
  document,
  collectionId,
  userId,
  onSaved,
  onSkip,
}: {
  document: DictionaryCollectionExportV2
  collectionId: string
  userId: string
  onSaved: (wordId: string) => void
  onSkip?: () => void
}) {
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef<FollowingImportOperation | null>(null)
  const entry = document.entries[index]
  const preview = buildWordDetail({
    ...projectDictionaryContent(entry.content),
    word_id: 'published-preview',
    collection_id: null,
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: '',
    last_reviewed_at: null,
    created_at: '',
    updated_at: null,
  })
  const linked = isLinkedWordImportEnabled()
  async function save() {
    setError('')
    setBusy(true)
    try {
      const result = await savePublishedWord({
        userId,
        collectionId,
        entry,
        previousIntent: operation.current,
        onIntent: intent => {
          operation.current = intent
        },
      })
      if (!result.success) throw new Error(result.message)
      onSaved(result.wordId)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save this word. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="dw-surface grid gap-4 p-5">
      <h2>Published meaning</h2>
      {document.entries.length > 1 && (
        <label>
          Choose a meaning
          <select
            className="dw-field"
            value={index}
            disabled={busy}
            onChange={e => {
              setIndex(Number(e.target.value))
              setError('')
            }}
          >
            {document.entries.map(({ content, shared_reference }, i) => (
              <option key={shared_reference?.reference.entry_id ?? i} value={i}>
                {content.article} {content.dutch_lemma} ·{' '}
                {content.translations.en.join(', ')}
              </option>
            ))}
          </select>
        </label>
      )}
      <WordDetailCard showProgress={false} word={preview} />
      {error && <p role="alert">{error}</p>}
      <Button
        type="button"
        disabled={busy || !collectionId}
        onClick={() => void save()}
      >
        {busy ? 'Saving…' : linked ? 'Save word' : 'Save personal copy'}
      </Button>
      {onSkip && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onSkip}
        >
          Skip this item
        </Button>
      )}
    </section>
  )
}
