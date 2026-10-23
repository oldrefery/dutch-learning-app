import { getDictionaryWordMaterializations } from '@/db/dictionaryWordReads'
import { applyDictionaryMaterializations } from '@/db/dictionaryWordMaterialization'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { compareDictionarySequences } from '@woordenaar/domain'

/** Reproject current personal rows, preserving reviews/edits completed during hydration. */
export async function refreshDictionaryAnalysisDisplay(
  userId: string,
  assertCurrent: () => void
) {
  assertCurrent()
  const assertOwner = () => {
    assertCurrent()
    if (useApplicationStore.getState().currentUserId !== userId)
      throw new Error('Shared analysis display owner changed')
  }
  assertOwner()
  const ids = useApplicationStore
    .getState()
    .words.filter(word => word.user_id === userId)
    .map(word => word.word_id)
  const cache = await getDictionaryWordMaterializations(userId, ids)
  assertOwner()
  useApplicationStore.setState(state => {
    assertOwner()
    return {
      words: state.words.map(word => {
        const materialization = cache.get(word.word_id)
        const current = word.dictionary_content_state
        if (
          word.user_id !== userId ||
          !materialization ||
          !('card' in materialization) ||
          materialization.card.mode !== 'follow' ||
          current?.mode !== 'follow' ||
          !current.head_sequence ||
          current.reference?.entry_id !==
            materialization.card.reference.entry_id
        )
          return word
        const comparison = compareDictionarySequences(
          materialization.card.head_sequence!,
          current.head_sequence
        )
        if (comparison < 0) return word
        if (
          comparison === 0 &&
          current.reference?.revision_id !==
            materialization.card.reference.revision_id
        )
          throw new Error('Shared analysis display revision changed')
        return applyDictionaryMaterializations([word], cache)[0]
      }),
    }
  })
}
