import { parseDictionaryEffectiveBatchV2 } from '@woordenaar/domain'
import { projectDictionaryContent, type EffectiveCard } from './content'

/** Index dependencies once, including the 10k-card review snapshot. */
export const parseFollowingCards = (value: unknown) => {
  const parsed = parseDictionaryEffectiveBatchV2(value)
  if (!parsed.success)
    throw new Error('Could not load dictionary content. Please retry.')
  const batch = parsed.data
  const revisions = new Map(
    batch.revisions.map(revision => [
      revision.revision_id,
      projectDictionaryContent(revision.content),
    ])
  )
  const cards = new Map<string, EffectiveCard>()
  for (const card of batch.cards) {
    const content =
      card.mode === 'legacy'
        ? projectDictionaryContent(card.legacy_content)
        : revisions.get(card.reference.revision_id)
    if (!content) throw new Error('Missing validated dictionary dependency.')
    cards.set(card.word_id, {
      wordId: card.word_id,
      // Keep the per-card projection independent; the batch already validated
      // each immutable revision once and each private legacy payload separately.
      content: { ...content },
      protocolVersion: 2,
      mode: card.mode,
      contentVersion: card.content_version,
      reference: card.reference,
      adoptedRevisionId: card.adopted_revision_id,
      headSequence: card.head_sequence,
      watermark: batch.watermark,
      source:
        card.mode === 'follow'
          ? 'following'
          : card.reference === null
            ? 'fallback'
            : 'pinned',
      cefr: card.cefr,
    })
  }
  return { cards, watermark: batch.watermark }
}

/** A page crossing a publication must retry, rather than show two current heads. */
export const validateFollowingHeads = (
  cards: ReadonlyMap<string, EffectiveCard>
): void => {
  const heads = new Map<string, { revisionId: string; sequence: string }>()
  for (const card of cards.values()) {
    if (card.mode !== 'follow' || !('headSequence' in card)) continue
    if (!card.reference || !card.headSequence)
      throw new Error('Invalid following dictionary reference.')
    const previous = heads.get(card.reference.entry_id)
    if (
      previous &&
      (previous.revisionId !== card.reference.revision_id ||
        previous.sequence !== card.headSequence)
    )
      throw new Error(
        'Dictionary content changed during loading. Please retry.'
      )
    heads.set(card.reference.entry_id, {
      revisionId: card.reference.revision_id,
      sequence: card.headSequence,
    })
  }
}
