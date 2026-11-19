'use client'

import { useRef, useState } from 'react'
import type {
  DictionaryCollectionExportV2,
  FollowingImportOperation,
} from '@woordenaar/domain'
import { refreshPublishedMeaning } from './refresh-published-meaning'
import { formatWordTranslations } from './format-word-translations'
import { Button } from '@/components/ui/Button'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import { formatDutchHeadword } from '@/features/words/dutch-headword'
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
  onUpdated,
  onSkip,
}: {
  document: DictionaryCollectionExportV2
  collectionId: string
  userId: string
  onSaved: (wordId: string) => void
  onUpdated?: (document: DictionaryCollectionExportV2) => void
  onSkip?: () => void
}) {
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState('')
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
  async function refresh() {
    if (!onUpdated || busy || refreshing) return
    setRefreshing(true)
    setError('')
    setNotice('')
    try {
      const { updated, message } = await refreshPublishedMeaning(userId, entry)
      if (updated) {
        operation.current = null
        onUpdated({
          ...document,
          entries: document.entries.map((item, i) =>
            i === index ? updated : item
          ),
        })
      }
      setNotice(message ?? 'Check the shared analysis status again.')
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not refresh the shared meaning.'
      )
    } finally {
      setRefreshing(false)
    }
  }
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
            disabled={busy || refreshing}
            onChange={e => {
              setIndex(Number(e.target.value))
              setError('')
              setNotice('')
            }}
          >
            {document.entries.map(({ content, shared_reference }, i) => (
              <option key={shared_reference?.reference.entry_id ?? i} value={i}>
                {formatDutchHeadword(content.dutch_lemma, content.article)} ·{' '}
                {formatWordTranslations(content.translations)}
              </option>
            ))}
          </select>
        </label>
      )}
      {entry.shared_reference && onUpdated && (
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? 'Refreshing…' : 'Refresh shared analysis'}
          </Button>
          <p className="dw-support">
            Updates this meaning in the shared dictionary for everyone.
          </p>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <WordDetailCard showProgress={false} word={preview} />
      <Button
        type="button"
        disabled={busy || refreshing || !collectionId}
        onClick={() => void save()}
      >
        {busy ? 'Saving…' : linked ? 'Save word' : 'Save personal copy'}
      </Button>
      {onSkip && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy || refreshing}
          onClick={onSkip}
        >
          Skip this item
        </Button>
      )}
    </section>
  )
}
