import { useState } from 'react'
import { Button } from 'react-native'
import { useRouter } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { OwnedPhrase } from '@/services/ownedPhrase'
import type { ImportTargetCollection } from '@/types/ImportTypes'

export function OwnedPhraseCard({
  word,
  collections,
  targetId,
  ownerId,
}: {
  word: OwnedPhrase
  collections: ImportTargetCollection[]
  targetId?: string
  ownerId: string
}) {
  const router = useRouter()
  const [location, setLocation] = useState(word.collection_id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const collection = collections.find(c => c.collection_id === location)
  const move = async () => {
    if (!targetId || busy) return
    setBusy(true)
    setError('')
    try {
      const store = useApplicationStore.getState()
      if (
        store.currentUserId !== ownerId ||
        !(await store.moveWordToCollection(word.word_id, targetId))
      )
        throw new Error(
          'Could not move this card. Sync your vocabulary and try again.'
        )
      setLocation(targetId)
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Could not move this card.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <ViewThemed>
      <TextThemed>{word.dutch_lemma}</TextThemed>
      <TextThemed>
        {location === targetId
          ? 'Already in this collection.'
          : `Already in ${collection?.name ?? 'your vocabulary'}.`}
      </TextThemed>
      <Button
        title="Open card"
        onPress={() =>
          router.push({
            pathname: '/collection/[id]',
            params: { id: location, openWordId: word.word_id },
          })
        }
      />
      {targetId && location !== targetId && (
        <Button
          disabled={busy}
          title={busy ? 'Moving…' : 'Move to selected collection'}
          onPress={() => void move()}
        />
      )}
      {!!error && <TextThemed accessibilityRole="alert">{error}</TextThemed>}
    </ViewThemed>
  )
}
