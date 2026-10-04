'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DictionaryCollectionExport } from '@woordenaar/domain'
import { Button } from '@/components/ui/Button'
import type { ExistingSharedImportWord } from './shared-collection-domain'
import type { SharedTargetCollection } from './repository'
import {
  buildTransferPreview,
  parseTransferText,
  requestDictionaryTransfer,
  type TransferPreviewWord,
  type TransferReply,
} from './dictionary-transfer-contract'
import { DictionaryDocumentPreview } from './DictionaryDocumentPreview'
import { TransferSessionNotice } from './TransferSessionNotice'
import { useTransferSession } from './useTransferSession'
import styles from './DictionaryTransfer.module.css'

type Saved = Extract<TransferReply, { status: 'saved' }>
type Feedback =
  | { message: string; uncertain: false }
  | { message: string; uncertain: true; collectionId: string }

function SavedImport({ result }: { result: Saved }) {
  return (
    <section className={`dw-surface ${styles.panel}`}>
      <h2>Import complete</h2>
      <p role="status">
        {result.savedCount === null
          ? 'The import completed, but the final word count could not be verified.'
          : `${result.savedCount} selected ${result.savedCount === 1 ? 'word' : 'words'} saved · ${result.skippedCount} already added.`}{' '}
        Existing words were kept in their collections.
      </p>
      {!result.cacheRefreshed && (
        <p>The words are saved. Reopen the collection to refresh its list.</p>
      )}
      <Link href={`/app/collections/${result.collectionId}`}>
        Open {result.collectionName}
      </Link>
    </section>
  )
}

export function DictionaryDocumentImport({
  ownerId,
  collections,
  existingWords,
}: {
  ownerId: string
  collections: SharedTargetCollection[]
  existingWords: ExistingSharedImportWord[]
}) {
  const session = useTransferSession(ownerId)
  const router = useRouter()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<{
    document: DictionaryCollectionExport
    words: TransferPreviewWord[]
  } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [target, setTarget] = useState(collections[0]?.id ?? '')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)

  const prepare = () => {
    if (!session.capture() || busy.current) return
    setFeedback(null)
    setPreview(null)
    try {
      const document = parseTransferText(text)
      const words = buildTransferPreview(document, existingWords)
      setPreview({ document, words })
      setSelected(
        new Set(words.filter(word => !word.duplicate).map(word => word.index))
      )
    } catch (error) {
      setSelected(new Set())
      setFeedback({
        message:
          error instanceof Error ? error.message : 'Invalid JSON export.',
        uncertain: false,
      })
    }
  }

  const submit = async () => {
    const ticket = session.capture()
    if (
      !ticket ||
      !preview ||
      !target ||
      selected.size === 0 ||
      busy.current ||
      feedback?.uncertain
    )
      return
    busy.current = true
    setPending(true)
    setFeedback(null)
    try {
      const result = await requestDictionaryTransfer({
        kind: 'import',
        ownerId,
        collectionId: target,
        document: preview.document,
        selectedIndexes: [...selected],
      })
      if (!session.isCurrent(ticket)) return
      if (result.status !== 'saved' || result.collectionId !== target) {
        setFeedback(
          result.status === 'error'
            ? { uncertain: false, message: result.message }
            : {
                uncertain: true,
                collectionId: target,
                message:
                  result.status === 'uncertain'
                    ? result.message
                    : 'The import could not be confirmed. Check the collection before retrying.',
              }
        )
        return
      }
      setSaved(result)
      try {
        router.refresh()
      } catch {
        setSaved({ ...result, cacheRefreshed: false })
      }
    } catch {
      if (session.isCurrent(ticket))
        setFeedback({
          uncertain: true,
          collectionId: target,
          message:
            'The import could not be confirmed. Check the collection, then preview again before retrying.',
        })
    } finally {
      busy.current = false
      if (session.isCurrent(ticket)) setPending(false)
    }
  }

  if (!session.active) return <TransferSessionNotice ready={session.ready} />
  if (saved) return <SavedImport result={saved} />
  return (
    <div className={`dw-surface ${styles.panel}`}>
      <h2>Paste a JSON export</h2>
      <p className="dw-support">
        Choose the words to import. New cards start with fresh learning
        progress; existing words stay where they are.
      </p>
      <div className={styles.field}>
        <label htmlFor="dictionary-import-json">JSON document</label>
        <textarea
          className={`dw-field ${styles.document}`}
          disabled={pending}
          id="dictionary-import-json"
          onChange={event => {
            setText(event.target.value)
            setPreview(null)
            setSelected(new Set())
            setFeedback(null)
          }}
          placeholder="Paste the complete JSON collection export"
          value={text}
        />
      </div>
      <Button
        disabled={pending || !text.trim()}
        onClick={prepare}
        type="button"
        variant="secondary"
      >
        Preview words
      </Button>
      {feedback && <p role="alert">{feedback.message}</p>}
      {feedback?.uncertain && (
        <Link href={`/app/collections/${feedback.collectionId}`}>
          Check the attempted collection
        </Link>
      )}
      {preview && (
        <form
          onSubmit={event => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className={styles.panel}>
            <h3>{preview.document.collection.name}</h3>
            <div className={styles.field}>
              <label htmlFor="dictionary-import-target">Import into</label>
              <select
                className="dw-field"
                disabled={pending || collections.length === 0}
                id="dictionary-import-target"
                onChange={event => setTarget(event.target.value)}
                value={target}
              >
                {collections.map(collection => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
            {collections.length === 0 && (
              <p>
                You need an existing collection before importing.{' '}
                <Link href="/app/collections">Open collections</Link>.
              </p>
            )}
            <DictionaryDocumentPreview
              disabled={pending}
              key={text}
              onSelectAll={all =>
                setSelected(
                  new Set(
                    all
                      ? preview.words
                          .filter(word => !word.duplicate)
                          .map(word => word.index)
                      : []
                  )
                )
              }
              onToggle={index =>
                setSelected(previous => {
                  const next = new Set(previous)
                  if (next.has(index)) next.delete(index)
                  else next.add(index)
                  return next
                })
              }
              selected={selected}
              words={preview.words}
            />
            <Button
              disabled={
                pending ||
                selected.size === 0 ||
                !collections.some(collection => collection.id === target) ||
                Boolean(feedback?.uncertain)
              }
              type="submit"
            >
              {pending
                ? 'Importing…'
                : `Import ${selected.size} selected ${selected.size === 1 ? 'word' : 'words'}`}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
