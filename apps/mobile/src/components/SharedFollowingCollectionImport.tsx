import { useEffect, useMemo, useRef, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import type { SharedDictionaryCollectionV2 } from '@woordenaar/domain'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { DictionaryFollowingTransferPanel } from './DictionaryFollowingTransferPanel'
import { readSharedFollowingCollection } from '@/services/sharedFollowingImport'
import { followingTransferStyles as styles } from '@/styles/DictionaryFollowingTransfer.styles'
import type { ImportTargetCollection } from '@/types/ImportTypes'

/** Mount opens only retained local sessions. Reading a new share is explicit. */
export function SharedFollowingCollectionImport({
  ownerId,
  shareToken,
  collections,
  onClose,
}: {
  ownerId: string
  shareToken: string
  collections: ImportTargetCollection[]
  onClose: () => void
}) {
  const [original, setOriginal] = useState<SharedDictionaryCollectionV2>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lifetime = useRef(0)
  const pending = useRef(false)
  useEffect(
    () => () => {
      lifetime.current += 1
    },
    []
  )
  const source = useMemo(
    () => (original ? { shareToken, original } : undefined),
    [shareToken, original]
  )
  const load = async () => {
    if (pending.current) return
    pending.current = true
    const epoch = lifetime.current
    const assert = () => {
      if (epoch !== lifetime.current)
        throw new Error('Shared collection view changed')
    }
    setBusy(true)
    setError(null)
    try {
      const shared = await readSharedFollowingCollection(
        ownerId,
        shareToken,
        assert
      )
      assert()
      setOriginal(shared)
    } catch (failure) {
      if (epoch === lifetime.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not load the shared collection.'
        )
    } finally {
      if (epoch === lifetime.current) {
        pending.current = false
        setBusy(false)
      }
    }
  }
  return (
    <ViewThemed style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Load shared collection"
        disabled={busy}
        onPress={() => {
          void load()
        }}
        style={styles.button}
      >
        <TextThemed>
          {busy ? 'Loading shared collection…' : 'Load shared collection'}
        </TextThemed>
      </TouchableOpacity>
      {error && <TextThemed accessibilityRole="alert">{error}</TextThemed>}
      <DictionaryFollowingTransferPanel
        ownerId={ownerId}
        sharedSource={source}
        collections={collections}
        onClose={onClose}
      />
    </ViewThemed>
  )
}
