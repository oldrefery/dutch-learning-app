'use client'

import { useEffect, useRef, useState } from 'react'
import type { DictionaryCollectionExportV2 } from '@woordenaar/domain'
import { Button } from '@/components/ui/Button'
import type { CollectionOption } from '@/features/words/repository'
import { DictionaryFollowingTransferPanel } from '@/features/sharing/DictionaryFollowingTransferPanel'
import { lookupPublishedMeanings } from './dictionary-meaning-lookup'

import { DictionaryCreationPanel } from '@/features/dictionary/DictionaryCreationPanel'

export function PublishedMeaningAddWord({
  ownerId,
  collections,
  followingEnabled,
}: {
  ownerId: string
  collections: CollectionOption[]
  followingEnabled: boolean
}) {
  const [input, setInput] = useState('')
  const [document, setDocument] = useState<DictionaryCollectionExportV2>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewEpoch, setPreviewEpoch] = useState(0)
  const epoch = useRef(0)
  const pending = useRef(false)
  useEffect(
    () => () => {
      epoch.current += 1
    },
    []
  )
  const change = (value: string) => {
    epoch.current += 1
    setPreviewEpoch(epoch.current)
    pending.current = false
    setBusy(false)
    setInput(value)
    setDocument(undefined)
    setError(null)
  }
  const lookup = async () => {
    if (pending.current) return
    pending.current = true
    epoch.current += 1
    setPreviewEpoch(epoch.current)
    const started = epoch.current
    const assert = () => {
      if (started !== epoch.current) throw new Error('Word input changed')
    }
    setBusy(true)
    setDocument(undefined)
    setError(null)
    try {
      const result = await lookupPublishedMeanings(
        ownerId,
        input,
        followingEnabled,
        assert
      )
      assert()
      setDocument(result)
    } catch (failure) {
      if (started === epoch.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not find published meanings.'
        )
    } finally {
      if (started === epoch.current) {
        pending.current = false
        setBusy(false)
      }
    }
  }
  return (
    <section>
      <form
        onSubmit={event => {
          event.preventDefault()
          void lookup()
        }}
      >
        <label>
          Dutch word or expression
          <input
            value={input}
            onChange={event => change(event.target.value)}
            className="dw-field mt-2"
          />
        </label>
        <Button type="submit" disabled={busy} className="mt-4">
          {busy ? 'Finding meanings…' : 'Find published meanings'}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {document?.entries.length === 0 && (
        <p role="status">
          No published meaning matches this exact word or expression. A new
          shared meaning needs review before it can be added.
        </p>
      )}
      <DictionaryCreationPanel
        key={`creation:${ownerId}:${input}:${followingEnabled}`}
        ownerId={ownerId}
        collections={collections}
        originalQuery={input}
        noMatch={document?.entries.length === 0}
        followingEnabled={followingEnabled}
      />
      <DictionaryFollowingTransferPanel
        key={previewEpoch}
        title="Published meaning import"
        onCloseLabel="Back"
        ownerId={ownerId}
        document={document}
        collections={collections}
        followingEnabled={followingEnabled}
        onClose={() => {
          window.history.back()
        }}
      />
    </section>
  )
}
