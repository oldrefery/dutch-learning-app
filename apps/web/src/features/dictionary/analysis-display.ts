import {
  compareDictionarySequences,
  parseDictionaryEffectiveBatchV2,
  requireDictionaryAnalysisPublication,
  type DictionaryAnalysisClientOperation,
} from '@woordenaar/domain'
import { buildWordDetail, type WordDetail } from '@/features/words/word-detail'
import { parseFollowingCards } from './following-content'

/** Only validated common content replaces display fields; current personal facts stay. */
export function applyDictionaryAnalysisSnapshot(
  word: WordDetail,
  operation: DictionaryAnalysisClientOperation,
  value: unknown
): WordDetail {
  const parsed = parseDictionaryEffectiveBatchV2(value)
  if (!parsed.success)
    throw new Error('Shared analysis display dependency is unavailable')
  const batch = parsed.data
  if (word.id !== operation.word_id || batch.cards.length !== 1)
    throw new Error('Shared analysis display word changed')
  requireDictionaryAnalysisPublication(operation, batch.cards[0])
  const card = parseFollowingCards(batch).cards.get(word.id)
  if (
    !card ||
    card.mode !== 'follow' ||
    !('headSequence' in card) ||
    !card.headSequence
  )
    throw new Error('Shared analysis display reference is unavailable')
  const current = word.dictionary
  if (
    !current ||
    current.mode !== 'follow' ||
    !('headSequence' in current) ||
    !current.headSequence ||
    current.reference?.entry_id !== card.reference?.entry_id
  )
    throw new Error('Shared analysis display reference changed')
  const comparison = compareDictionarySequences(
    card.headSequence,
    current.headSequence
  )
  if (comparison < 0) return word
  if (
    comparison === 0 &&
    card.reference?.revision_id !== current.reference?.revision_id
  )
    throw new Error('Shared analysis display revision changed')
  const { content, wordId, ...dictionary } = card
  void wordId
  return buildWordDetail({
    ...content,
    dictionary,
    word_id: word.id,
    user_id: operation.user_id,
    collection_id: word.collectionId,
    deleted_at: null,
    created_at: word.createdAt,
    updated_at: word.updatedAt,
    interval_days: word.intervalDays,
    repetition_count: word.repetitionCount,
    easiness_factor: word.easinessFactor,
    next_review_date: word.nextReviewDate,
    last_reviewed_at: word.lastReviewedAt,
  })
}
