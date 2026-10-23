import {
  compareDictionarySequences,
  parseDictionaryChangePageV2,
  parseDictionaryEffectiveBatchV2,
  type DictionaryChangePageV2,
  type DictionaryEffectiveBatchV2,
  type DictionaryEffectiveCardV2,
  type DictionaryRevision,
  type DictionaryValidationResult,
} from '@woordenaar/domain'

export interface CachedDictionaryEffectiveCard {
  card: DictionaryEffectiveCardV2
  revision: DictionaryRevision | null
  watermark: string
}

export interface CachedDictionaryHead {
  revisionId: string
  sequence: string
  watermark: string
  cefrJson: string
}

export const requireFollowingValue = <T>(
  result: DictionaryValidationResult<T>
): T => {
  if (!result.success) throw new Error('Invalid dictionary following response')
  return result.data
}

export const canonicalDictionaryJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value))
    return `[${value.map(canonicalDictionaryJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map(
      key => `${JSON.stringify(key)}:${canonicalDictionaryJson(record[key])}`
    )
    .join(',')}}`
}

export const boundedDictionaryWordIds = (ids: readonly string[]): string[] => {
  if (ids.length > 10_000 || new Set(ids).size !== ids.length)
    throw new Error('Invalid dictionary hydration request size')
  return [...ids]
}

const indexRevisions = (batches: readonly DictionaryEffectiveBatchV2[]) => {
  const revisions = new Map<string, DictionaryRevision>()
  for (const revision of batches.flatMap(batch => batch.revisions)) {
    const existing = revisions.get(revision.revision_id)
    if (
      existing &&
      canonicalDictionaryJson(existing) !== canonicalDictionaryJson(revision)
    )
      throw new Error('Dictionary revision identity conflict')
    revisions.set(revision.revision_id, revision)
  }
  return revisions
}

const indexCards = (
  batches: readonly DictionaryEffectiveBatchV2[],
  revisions: ReadonlyMap<string, DictionaryRevision>
) => {
  const cards = new Map<string, CachedDictionaryEffectiveCard>()
  for (const batch of batches) {
    for (const card of batch.cards) {
      if (cards.has(card.word_id)) throw new Error('Duplicate dictionary card')
      cards.set(card.word_id, {
        card,
        watermark: batch.watermark,
        revision:
          card.reference === null
            ? null
            : (revisions.get(card.reference.revision_id) ?? null),
      })
    }
  }
  return cards
}

const indexHeads = (
  cards: ReadonlyMap<string, CachedDictionaryEffectiveCard>
) => {
  const heads = new Map<string, CachedDictionaryHead>()
  for (const { card, watermark } of cards.values()) {
    if (card.mode !== 'follow') continue
    const previous = heads.get(card.reference.entry_id)
    const cefrJson = canonicalDictionaryJson(card.cefr)
    if (
      previous &&
      (previous.revisionId !== card.reference.revision_id ||
        previous.sequence !== card.head_sequence ||
        previous.cefrJson !== cefrJson)
    )
      throw new Error('Dictionary head changed during hydration')
    heads.set(card.reference.entry_id, {
      revisionId: card.reference.revision_id,
      sequence: card.head_sequence,
      cefrJson,
      watermark:
        previous &&
        compareDictionarySequences(previous.watermark, watermark) > 0
          ? previous.watermark
          : watermark,
    })
  }
  return heads
}

const validateBoundary = (
  batches: readonly DictionaryEffectiveBatchV2[],
  heads: ReadonlyMap<string, CachedDictionaryHead>,
  page: DictionaryChangePageV2
) => {
  if (
    batches.some(
      batch => compareDictionarySequences(batch.watermark, page.next_cursor) < 0
    )
  )
    throw new Error('Dictionary hydration predates its change page')
  for (const change of page.changes) {
    const head = heads.get(change.entry_id)
    if (
      head &&
      change.kind === 'revision-head' &&
      compareDictionarySequences(head.sequence, change.cursor) < 0
    )
      throw new Error('Dictionary head predates its change page')
  }
}

export const parseFollowingHydration = (
  wordIds: readonly string[],
  values: readonly unknown[],
  pageValue?: unknown
) => {
  const requested = new Set(boundedDictionaryWordIds(wordIds))
  if (values.length > Math.max(1, requested.size))
    throw new Error('Invalid dictionary hydration batch count')
  let cardCount = 0
  const batches = values.map(value => {
    const batch = requireFollowingValue(parseDictionaryEffectiveBatchV2(value))
    cardCount += batch.cards.length
    if (cardCount > requested.size)
      throw new Error('Incomplete dictionary hydration')
    return batch
  })
  const page =
    pageValue === undefined
      ? null
      : requireFollowingValue(parseDictionaryChangePageV2(pageValue))
  const revisions = indexRevisions(batches)
  const cards = indexCards(batches, revisions)
  const heads = indexHeads(cards)
  if (
    cards.size !== requested.size ||
    [...cards.keys()].some(id => !requested.has(id))
  )
    throw new Error('Incomplete dictionary hydration')
  if (page) validateBoundary(batches, heads, page)
  return { cards, revisions, heads, requested, page }
}
