import { OwnedPhraseCard } from '@/components/AddWordScreen/components/OwnedPhraseCard'
import { findOwnedPhrase, type OwnedPhrase } from '@/services/ownedPhrase'
import { ImportCollectionSelector } from '@/components/ImportCollectionSelector'
import { exactPhraseInput, wordVariantInputLabel } from '@woordenaar/domain'
import { useEffect, useRef, useState } from 'react'
import { TextInput, TouchableOpacity } from 'react-native'
import type {
  DictionaryCreationJournalRow,
  DictionaryCollectionExportV2,
} from '@woordenaar/domain'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { lookupPublishedMeanings } from '@/services/dictionaryMeaningLookup'
import { followingTransferStyles as styles } from '@/styles/DictionaryFollowingTransfer.styles'
import type { ImportTargetCollection } from '@/types/ImportTypes'
import { DictionaryFollowingTransferPanel } from './DictionaryFollowingTransferPanel'

import { DictionaryCreationPanel } from './DictionaryCreationPanel'

export function PublishedMeaningAddWord({
  ownerId,
  collections,
  initialWord = '',
  onClose,
  onLoaded,
}: {
  ownerId: string
  collections: ImportTargetCollection[]
  initialWord?: string
  onClose: () => void
  onLoaded?: (
    row: DictionaryCreationJournalRow,
    assertCurrent: () => void
  ) => void | Promise<void>
}) {
  const colors = Colors[useNormalizedColorScheme()]
  const [input, setInput] = useState(initialWord)
  const [document, setDocument] = useState<DictionaryCollectionExportV2>()
  const [owned, setOwned] = useState<OwnedPhrase | null>(null)
  const [target, setTarget] = useState(collections[0]?.collection_id)
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
    setOwned(null)
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
    setOwned(null)
    setError(null)
    try {
      const phrase = exactPhraseInput(input)
      if (phrase) {
        const match = await findOwnedPhrase(ownerId, phrase)
        assert()
        if (match) {
          setOwned(match)
          return
        }
      }
      const result = await lookupPublishedMeanings(ownerId, input, assert)
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
    <ViewThemed style={styles.container}>
      <ViewThemed style={styles.content}>
        <TextThemed>
          Find a published Dutch word or expression, then select the meanings to
          add.
        </TextThemed>
        <TextInput
          accessibilityLabel="Dutch word or expression"
          value={input}
          onChangeText={change}
          autoCapitalize="none"
          style={[styles.button, { color: colors.text }]}
        />
        <TextThemed>{wordVariantInputLabel(input)}</TextThemed>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Find published meanings"
          disabled={busy}
          style={styles.button}
          onPress={() => {
            void lookup()
          }}
        >
          <TextThemed>
            {busy ? 'Finding meanings…' : 'Find published meanings'}
          </TextThemed>
        </TouchableOpacity>
        {owned && (
          <>
            <ImportCollectionSelector
              collections={collections}
              targetCollectionId={target ?? null}
              onSelectCollection={setTarget}
            />
            <OwnedPhraseCard
              key={owned.word_id}
              word={owned}
              collections={collections}
              targetId={target}
              ownerId={ownerId}
            />
          </>
        )}
        {error && <TextThemed accessibilityRole="alert">{error}</TextThemed>}
        {document?.entries.length === 0 && (
          <TextThemed>
            No published meaning matches this exact word or expression. A new
            shared meaning needs review before it can be added.
          </TextThemed>
        )}
      </ViewThemed>
      <DictionaryCreationPanel
        key={`creation:${ownerId}:${input}`}
        ownerId={ownerId}
        collections={collections}
        onLoaded={onLoaded}
        originalQuery={input}
        noMatch={document?.entries.length === 0}
      />
      <DictionaryFollowingTransferPanel
        key={previewEpoch}
        title="Published meaning import"
        onCloseLabel="Back"
        ownerId={ownerId}
        document={document}
        collections={collections}
        onClose={onClose}
      />
    </ViewThemed>
  )
}
