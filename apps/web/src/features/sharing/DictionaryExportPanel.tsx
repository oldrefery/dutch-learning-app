'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { requestDictionaryTransfer } from './dictionary-transfer-contract'
import { useTransferSession } from './useTransferSession'
import { TransferSessionNotice } from './TransferSessionNotice'
import styles from './DictionaryTransfer.module.css'

export function DictionaryExportPanel({
  ownerId,
  collectionId,
}: {
  ownerId: string
  collectionId: string
}) {
  const session = useTransferSession(ownerId)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    error: boolean
    message: string
  } | null>(null)

  const prepare = async () => {
    const ticket = session.capture()
    if (!ticket || busy.current) return
    busy.current = true
    setPending(true)
    setFeedback(null)
    setText(null)
    try {
      const result = await requestDictionaryTransfer({
        kind: 'export',
        ownerId,
        collectionId,
      })
      if (!session.isCurrent(ticket)) return
      if (result.status !== 'exported') {
        setFeedback({
          error: true,
          message:
            result.status === 'error' || result.status === 'uncertain'
              ? result.message
              : 'Could not export the collection.',
        })
        return
      }
      setText(JSON.stringify(result.document))
      setFeedback({
        error: false,
        message: 'JSON export ready. Copy it below.',
      })
    } catch {
      if (session.isCurrent(ticket))
        setFeedback({
          error: true,
          message: 'Could not export the collection. Please try again.',
        })
    } finally {
      busy.current = false
      if (session.isCurrent(ticket)) setPending(false)
    }
  }

  const copy = async () => {
    const ticket = session.capture()
    if (!ticket || text === null || busy.current) return
    busy.current = true
    setPending(true)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      if (session.isCurrent(ticket))
        setFeedback({ error: false, message: 'JSON copied.' })
    } catch {
      if (session.isCurrent(ticket))
        setFeedback({
          error: true,
          message: 'Copy failed. Select the JSON below and copy it manually.',
        })
    } finally {
      busy.current = false
      if (session.isCurrent(ticket)) setPending(false)
    }
  }

  if (!session.active) return <TransferSessionNotice ready={session.ready} />
  return (
    <section
      aria-label="JSON collection export"
      className={`dw-surface ${styles.panel}`}
    >
      <h3>Export collection</h3>
      <p className="dw-support">
        Copy the word content as JSON to import into another account. Learning
        progress stays in this account.
      </p>
      <div className={styles.actions}>
        <Button
          disabled={pending}
          onClick={() => void prepare()}
          type="button"
          variant="secondary"
        >
          {pending && text === null ? 'Preparing…' : 'Prepare JSON export'}
        </Button>
        {text !== null && (
          <Button disabled={pending} onClick={() => void copy()} type="button">
            Copy JSON
          </Button>
        )}
      </div>
      {feedback && (
        <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>
      )}
      {text !== null && (
        <div className={styles.field}>
          <label htmlFor="dictionary-export-json">JSON export</label>
          <textarea
            className={`dw-field ${styles.document}`}
            id="dictionary-export-json"
            readOnly
            value={text}
          />
        </div>
      )}
      <Link href="/app/dictionary-import">Import a JSON export</Link>
    </section>
  )
}
