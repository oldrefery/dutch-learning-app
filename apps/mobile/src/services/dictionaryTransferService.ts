import { parseDictionaryCollectionExport } from '@woordenaar/domain'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { collectionRepository } from '@/db/collectionRepository'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { applyDictionaryMaterializations } from '@/db/dictionaryWordMaterialization'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import { useApplicationStore } from '@/stores/useApplicationStore'

/** Export current owned offline content; learning state and reference IDs stay local. */
export async function exportOfflineDictionaryCollection(collectionId: string) {
  const userId = useApplicationStore.getState().currentUserId
  if (!userId) throw new Error('Authentication is required.')
  const collections = await collectionRepository.getCollectionsByUserId(userId)
  const collection = collections.find(
    item => item.collection_id === collectionId
  )
  if (!collection) throw new Error('Collection not found or access denied.')
  const words = (await wordRepository.getWordsByUserId(userId)).filter(
    word => word.collection_id === collectionId
  )
  const materializations = isDictionaryContentEnabled()
    ? await dictionaryContentRepository.getMaterializedContent(
        userId,
        words.map(word => word.word_id)
      )
    : new Map()
  if (
    isDictionaryContentEnabled() &&
    words.some(word => {
      const card = materializations.get(word.word_id)
      return (
        !card ||
        card.dependency_status !== 'ready' ||
        card.effective.content === null
      )
    })
  )
    throw new Error('Dictionary content is incomplete. Sync before exporting.')
  if (useApplicationStore.getState().currentUserId !== userId)
    throw new Error('The active account changed.')
  return parseDictionaryCollectionExport({
    schema_version: 1,
    collection: { name: collection.name },
    entries: applyDictionaryMaterializations(words, materializations).map(
      word => ({ content: wordToDictionaryContent(word) })
    ),
  })
}
