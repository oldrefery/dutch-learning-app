import { createHash } from 'node:crypto'

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function normalize(value) {
  return value
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('nl')
    .replace(/\s+/gu, ' ')
}

function canonical(value) {
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

export function contentHash(card) {
  // Membership/time are tracked separately; learning progress is not in this export.
  const { collection_id, updated_at, ...content } = card
  return sha256(JSON.stringify(canonical(content)))
}

export function parseSnapshot(text) {
  const input = text.replace(/^\uFEFF/u, '').trim()
  if (input.startsWith('{')) return JSON.parse(input)
  const lineEnd = input.indexOf('\n')
  if (input.slice(0, lineEnd).trim() !== 'snapshot') {
    throw new Error('Expected a JSON snapshot or a single-column snapshot CSV')
  }
  const cell = input.slice(lineEnd + 1).trim()
  if (!cell.startsWith('"') || !cell.endsWith('"')) {
    throw new Error('Expected one quoted JSON cell in the snapshot CSV')
  }
  return JSON.parse(cell.slice(1, -1).replaceAll('""', '"'))
}

function validateCard(card, collectionIds) {
  if (!card || !uuid.test(card.word_id)) throw new Error('Invalid card ID')
  if (!card.dutch_lemma?.trim() || typeof card.part_of_speech !== 'string') {
    throw new Error('Card requires a lemma and part of speech')
  }
  if (card.collection_id !== null && !collectionIds.has(card.collection_id)) {
    throw new Error('Card references a collection outside the snapshot')
  }
  if (typeof card.is_expression !== 'boolean')
    throw new Error('Missing expression flag')
  if (
    card.expression_type !== null &&
    typeof card.expression_type !== 'string'
  ) {
    throw new Error('Missing expression type')
  }
  if (!card.translations || typeof card.translations !== 'object') {
    throw new Error('Missing translations')
  }
  if (Number.isNaN(Date.parse(card.updated_at)))
    throw new Error('Missing card timestamp')
}

export function validateSnapshot(snapshot, options) {
  if (snapshot.schemaVersion !== 1 || snapshot.matchedAccounts !== 1) {
    throw new Error(
      'Snapshot must match exactly one account and schema version 1'
    )
  }
  if (!uuid.test(options.ownerId) || snapshot.ownerId !== options.ownerId) {
    throw new Error(
      'Snapshot owner does not match the explicitly supplied owner'
    )
  }
  if (!Array.isArray(snapshot.cards) || !Array.isArray(snapshot.collections)) {
    throw new Error('Snapshot requires card and collection arrays')
  }
  if (
    !Number.isInteger(options.expectedCards) ||
    options.expectedCards < 1 ||
    snapshot.cards.length !== options.expectedCards
  ) {
    throw new Error(
      'Card count does not match the independently verified count'
    )
  }
  if (Number.isNaN(Date.parse(snapshot.capturedAt)))
    throw new Error('Missing snapshot timestamp')
  const collectionIds = new Set(
    snapshot.collections.map(collection => collection.collection_id)
  )
  if (
    collectionIds.size !== snapshot.collections.length ||
    [...collectionIds].some(id => !uuid.test(id))
  ) {
    throw new Error('Invalid or duplicate collection IDs')
  }
  if (!collectionIds.has(options.protectedId))
    throw new Error('Protected collection not found')
  snapshot.collections.forEach(collection => {
    if (typeof collection.is_shared !== 'boolean')
      throw new Error('Missing sharing state')
  })
  snapshot.cards.forEach(card => validateCard(card, collectionIds))
  if (
    new Set(snapshot.cards.map(card => card.word_id)).size !==
    snapshot.cards.length
  ) {
    throw new Error('Duplicate card IDs')
  }
}
