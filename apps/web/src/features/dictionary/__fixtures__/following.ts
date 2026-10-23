import { createWordRow, effectiveCard } from './cards'

export const publishedRevision = () => {
  const legacy = effectiveCard()
  return {
    ...legacy.reference,
    revision_no: 2,
    schema_version: 1,
    content: { ...legacy.content, examples: [] },
    content_sha256: 'a'.repeat(64),
    cefr_input_sha256: 'b'.repeat(64),
    review_status: 'published',
  }
}

export const followingCard = (wordId = createWordRow().word_id) => ({
  word_id: wordId,
  mode: 'follow',
  content_version: '9007199254740993',
  reference: effectiveCard().reference,
  adopted_revision_id: '33333333-3333-4333-8333-333333333333',
  head_sequence: '9007199254740994',
  legacy_content: null,
  removed_fields: [],
  cefr: effectiveCard().cefr,
})

export const followingBatch = (ids = [createWordRow().word_id]) => ({
  protocol_version: 2,
  watermark: '9007199254740994',
  cards: ids.map(followingCard),
  revisions: ids.length === 0 ? [] : [publishedRevision()],
})

export const followingSnapshot = () => ({
  protocolVersion: 3,
  dictionaryContentProtocol: 2,
  correctionsAvailable: true,
  collections: [],
  events: [],
  words: [createWordRow({ repetition_count: 12 })],
  dictionaryContent: followingBatch(),
})
