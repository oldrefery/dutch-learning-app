import type {
  DictionaryAnalysisClientOperation,
  DictionaryAnalysisReceiptV2,
} from '@woordenaar/domain'
import { applyDictionaryAnalysisSnapshot } from './analysis-display'
import { followingBatch } from './__fixtures__/following'
import { applyEffectiveCards } from './content'
import { parseFollowingCards } from './following-content'
import { buildWordDetail } from '@/features/words/word-detail'
import { createWordRow } from './__fixtures__/cards'

const OWNER = '44444444-4444-4444-8444-444444444444'
const batch = followingBatch()
const initial = buildWordDetail(
  applyEffectiveCards(
    [createWordRow({ user_id: OWNER, repetition_count: 9 })],
    parseFollowingCards(batch).cards
  )[0]
)
const receipt: DictionaryAnalysisReceiptV2 = {
  protocol_version: 2,
  operation_id: '55555555-5555-4555-8555-555555555555',
  entry_id: batch.cards[0].reference.entry_id,
  expected_revision_id: batch.cards[0].reference.revision_id,
  expected_head_sequence: batch.cards[0].head_sequence,
  fence: '9007199254740997',
  status: 'published',
  quota_charged: true,
  result_sha256: 'a'.repeat(64),
  error_code: null,
  published_revision_id: '66666666-6666-4666-8666-666666666666',
  published_head_sequence: '9007199254740995',
}
const operation: DictionaryAnalysisClientOperation = {
  user_id: OWNER,
  word_id: initial.id,
  submitted: true,
  command: {
    protocol_version: 2,
    operation_id: receipt.operation_id,
    entry_id: receipt.entry_id,
    expected_revision_id: receipt.expected_revision_id,
    expected_head_sequence: receipt.expected_head_sequence,
  },
  response: receipt,
}
const published = () => {
  const value = followingBatch()
  value.watermark = receipt.published_head_sequence!
  value.cards[0].head_sequence = receipt.published_head_sequence!
  value.cards[0].reference.revision_id = receipt.published_revision_id!
  value.revisions[0].revision_id = receipt.published_revision_id!
  value.revisions[0].content.translations.en = ['new shared dwelling']
  return value
}
describe('validated shared snapshot display', () => {
  it('applies only common content and exact new reference while preserving current personal facts', () => {
    const current = {
      ...initial,
      repetitionCount: 23,
      intervalDays: 40,
      easinessFactor: 2.9,
      lastReviewedAt: '2026-10-10T11:00:00Z',
    }
    const next = applyDictionaryAnalysisSnapshot(
      current,
      operation,
      published()
    )
    expect(next.translations.en).toEqual(['new shared dwelling'])
    expect(
      next.dictionary &&
        'headSequence' in next.dictionary &&
        next.dictionary.headSequence
    ).toBe(receipt.published_head_sequence)
    for (const key of [
      'id',
      'collectionId',
      'createdAt',
      'updatedAt',
      'repetitionCount',
      'intervalDays',
      'easinessFactor',
      'lastReviewedAt',
      'nextReviewDate',
    ] as const)
      expect(next[key]).toEqual(current[key])
  })
  it('keeps a newer visible rollback and never restores an older publication', () => {
    const newer = {
      ...initial,
      dictionary: {
        ...initial.dictionary!,
        protocolVersion: 2 as const,
        mode: 'follow' as const,
        contentVersion: '1',
        adoptedRevisionId: null,
        headSequence: '9007199254740996',
        watermark: '9007199254740996',
      },
    }
    expect(applyDictionaryAnalysisSnapshot(newer, operation, published())).toBe(
      newer
    )
  })
  it.each(['word', 'entry', 'stale', 'dependency', 'extra-card'])(
    'rejects %s snapshot before display mutation',
    kind => {
      const value = published()
      if (kind === 'word') value.cards[0].word_id = OWNER
      else if (kind === 'entry') {
        value.cards[0].reference.entry_id = OWNER
        value.revisions[0].entry_id = OWNER
      } else if (kind === 'stale')
        value.cards[0].head_sequence = batch.cards[0].head_sequence
      else if (kind === 'dependency') value.revisions = []
      else value.cards.push({ ...value.cards[0], word_id: OWNER })
      expect(() =>
        applyDictionaryAnalysisSnapshot(initial, operation, value)
      ).toThrow()
      expect(initial.translations.en).toEqual(['dwelling'])
    }
  )
})
