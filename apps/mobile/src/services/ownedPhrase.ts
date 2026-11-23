import { exactPhraseInput } from '@woordenaar/domain'
import { syncManager } from '@/services/syncManager'
import { wordService } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'

export interface OwnedPhrase {
  word_id: string
  collection_id: string
  dutch_lemma: string
}

export async function findOwnedPhrase(
  ownerId: string,
  phrase: string
): Promise<OwnedPhrase | null> {
  const ownedStore = () => {
    const store = useApplicationStore.getState()
    if (store.currentUserId !== ownerId)
      throw new Error('Your account changed. Search again.')
    return store
  }
  const localMatch = () =>
    ownedStore().words.find(
      row =>
        row.user_id === ownerId &&
        exactPhraseInput(row.dutch_lemma)?.toLowerCase() ===
          phrase.toLowerCase()
    )
  let row = localMatch()
  if (!row && (await wordService.findWordByLemma(ownerId, phrase))) {
    ownedStore()
    await syncManager.performSync(ownerId)
    await ownedStore().fetchWords()
    row = localMatch()
    if (!row)
      throw new Error(
        'This phrase is in your cloud vocabulary. Sync this device and search again.'
      )
  }
  ownedStore()
  return row?.collection_id
    ? {
        word_id: row.word_id,
        collection_id: row.collection_id,
        dutch_lemma: row.dutch_lemma,
      }
    : null
}
