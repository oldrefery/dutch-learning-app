'use client'

import { OwnedPhraseCard } from './OwnedPhraseCard'
import { findOwnedPhrase } from './actions'
import type { DuplicateWordResult } from './form-state'
import { exactPhraseInput, wordVariantInputLabel } from '@woordenaar/domain'
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
  const [owned, setOwned] = useState<DuplicateWordResult | null>(null)
  const [targetId, setTargetId] = useState(collections[0]?.id ?? '')
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
    setOwned(null)
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
    setOwned(null)
    setDocument(undefined)
    setError(null)
    try {
      if (exactPhraseInput(input)) {
        const match = await findOwnedPhrase(ownerId, input)
        assert()
        if (match) {
          setOwned(match)
          return
        }
      }
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
        <p>{wordVariantInputLabel(input)}</p>
        <Button type="submit" disabled={busy} className="mt-4">
          {busy ? 'Finding meanings…' : 'Find published meanings'}
        </Button>
      </form>
      {owned && (
        <>
          <label>
            Collection
            <select
              className="dw-field"
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
            >
              {collections.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <OwnedPhraseCard word={owned} phrase={input} targetId={targetId} />
        </>
      )}
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
