import { contentHash } from '../vocabulary/snapshot.mjs'
import { sha256 } from './artifact-integrity.mjs'

const EDITORIAL_FIELDS = Object.freeze([
  'is_irregular',
  'conjugation',
  'plural',
  'synonyms',
  'antonyms',
])

const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonical(value[key])])
    )
  }
  return value
}

const requireUniqueCards = (cards, label) => {
  if (!Array.isArray(cards)) throw new Error(`${label} cards must be an array.`)
  const cardsById = new Map()
  for (const card of cards) {
    if (
      !card ||
      typeof card.word_id !== 'string' ||
      card.word_id === '' ||
      cardsById.has(card.word_id)
    ) {
      throw new Error(`${label} cards must have unique non-empty word IDs.`)
    }
    cardsById.set(card.word_id, card)
  }
  return cardsById
}

const validateEditorialFields = card => {
  if (
    typeof card.is_irregular !== 'boolean' ||
    (card.conjugation !== null &&
      (typeof card.conjugation !== 'object' ||
        Array.isArray(card.conjugation))) ||
    (card.plural !== null && typeof card.plural !== 'string') ||
    !Array.isArray(card.synonyms) ||
    !card.synonyms.every(value => typeof value === 'string') ||
    !Array.isArray(card.antonyms) ||
    !card.antonyms.every(value => typeof value === 'string') ||
    Number.isNaN(Date.parse(card.updated_at))
  ) {
    throw new Error(`Editorial card ${card.word_id} has invalid source fields.`)
  }
  for (const field of EDITORIAL_FIELDS) {
    if (!Object.hasOwn(card, field)) {
      throw new Error(`Editorial card ${card.word_id} is missing ${field}.`)
    }
  }
}

const baselineProjection = (editorialCard, baselineCard) =>
  Object.fromEntries(
    Object.keys(baselineCard).map(field => [field, editorialCard[field]])
  )

const changedFields = (baselineCard, editorialCard) =>
  Object.keys(baselineCard)
    .filter(field => field !== 'updated_at')
    .filter(
      field =>
        JSON.stringify(canonical(baselineCard[field])) !==
        JSON.stringify(canonical(editorialCard[field]))
    )
    .sort()

const unresolvedLinguisticFields = card => {
  const fields = []
  if (card.part_of_speech === 'verb' && card.conjugation === null) {
    fields.push('conjugation')
  }
  return fields
}

const proposedEntryWithLinguisticFields = (entry, editorialCard) => {
  const proposed = {
    ...entry,
    synonyms: editorialCard.synonyms,
    antonyms: editorialCard.antonyms,
  }
  if (entry.part_of_speech === 'verb') {
    proposed.is_irregular = editorialCard.is_irregular
    proposed.conjugation = editorialCard.conjugation
  }
  if (entry.part_of_speech === 'noun') {
    proposed.plural = editorialCard.plural
  }
  return proposed
}

export const analyzeEditorialSnapshot = ({
  baselineSnapshot,
  editorialSnapshot,
  mappedWordIds,
}) => {
  if (
    editorialSnapshot?.matchedAccounts !== 1 ||
    editorialSnapshot.ownerId !== baselineSnapshot.ownerId ||
    Number.isNaN(Date.parse(editorialSnapshot.capturedAt)) ||
    Date.parse(editorialSnapshot.capturedAt) <
      Date.parse(baselineSnapshot.capturedAt)
  ) {
    throw new Error('Editorial snapshot identity or timestamp is invalid.')
  }
  const baselineById = requireUniqueCards(
    baselineSnapshot.cards,
    'Baseline snapshot'
  )
  const editorialById = requireUniqueCards(
    editorialSnapshot.cards,
    'Editorial snapshot'
  )
  const missingIds = [...baselineById.keys()].filter(
    wordId => !editorialById.has(wordId)
  )
  if (missingIds.length > 0) {
    throw new Error(
      `Editorial snapshot is missing ${missingIds.length} baseline cards.`
    )
  }
  const mappedIds = new Set(mappedWordIds)
  const evidenceByWordId = new Map()
  let changedCount = 0
  let mappedChangedCount = 0
  let unresolvedMappedCount = 0

  for (const [wordId, baselineCard] of baselineById) {
    const editorialCard = editorialById.get(wordId)
    validateEditorialFields(editorialCard)
    const fields = changedFields(baselineCard, editorialCard)
    const contentChanged = fields.length > 0
    if (contentChanged) changedCount += 1
    if (contentChanged && mappedIds.has(wordId)) mappedChangedCount += 1
    const unresolved = unresolvedLinguisticFields(editorialCard)
    if (mappedIds.has(wordId) && unresolved.length > 0) {
      unresolvedMappedCount += 1
    }
    const linguisticEvidence = Object.fromEntries(
      EDITORIAL_FIELDS.map(field => [field, editorialCard[field]])
    )
    evidenceByWordId.set(wordId, {
      sourceUpdatedAt: editorialCard.updated_at,
      baselineSourceContentSha256: contentHash(baselineCard),
      currentSourceContentSha256: contentHash(
        baselineProjection(editorialCard, baselineCard)
      ),
      contentChanged,
      changedFields: fields,
      currentSourceContent: contentChanged
        ? baselineProjection(editorialCard, baselineCard)
        : null,
      linguisticEvidence,
      linguisticEvidenceSha256: sha256(
        JSON.stringify(canonical(linguisticEvidence))
      ),
      unresolvedLinguisticFields: unresolved,
    })
  }

  const addedIds = [...editorialById.keys()].filter(
    wordId => !baselineById.has(wordId)
  )
  return {
    evidenceByWordId,
    summary: {
      capturedAt: editorialSnapshot.capturedAt,
      baselineCardCount: baselineById.size,
      currentCardCount: editorialById.size,
      addedCardCount: addedIds.length,
      missingCardCount: missingIds.length,
      contentChangedCardCount: changedCount,
      mappedContentChangedCardCount: mappedChangedCount,
      unresolvedMappedLinguisticCardCount: unresolvedMappedCount,
    },
  }
}

export const enrichDraftEntry = (entry, evidence) => {
  if (!evidence) {
    throw new Error(`Missing editorial evidence for ${entry.entry_id}.`)
  }
  return proposedEntryWithLinguisticFields(entry, evidence.linguisticEvidence)
}
