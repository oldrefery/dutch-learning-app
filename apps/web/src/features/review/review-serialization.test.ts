import { mapReviewSnapshot } from './repository'
import type { DictionaryCardMetadata } from '@/features/dictionary/content'
import {
  deserializeReviewWorkspace,
  serializeReviewWorkspace,
} from './review-serialization'
import { followingSnapshot } from '@/features/dictionary/__fixtures__/following'
import { createReviewSessionController } from './session-controller'
import { successfulResult } from './__fixtures__/session'
import type { ReviewWorkspaceData } from './types'

jest.mock('server-only', () => ({}))

const dataFor = (count = 4): ReviewWorkspaceData => {
  const data = mapReviewSnapshot(followingSnapshot())
  return {
    ...data,
    words: Array.from({ length: count }, (_, index) => ({
      ...data.words[0],
      id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      collectionId: index % 2 ? 'second-collection' : null,
      repetitionCount: index,
      dictionary: JSON.parse(
        JSON.stringify(data.words[0].dictionary)
      ) as DictionaryCardMetadata,
    })),
  }
}

it('sends shared descriptors once while preserving every word, learning, event and decimal counter', () => {
  const original = dataFor(5000)
  const wire = serializeReviewWorkspace(original)
  if (!('serializedReviewWorkspace' in wire))
    throw new Error('Expected serialized data')
  const indexed = JSON.parse(wire.serializedReviewWorkspace)
  expect(indexed.dictionaryMetadata).toHaveLength(1)
  expect(indexed.words).toHaveLength(5000)
  expect(JSON.stringify(wire).length).toBeLessThan(
    JSON.stringify(original).length * 0.7
  )
  const restored = deserializeReviewWorkspace(JSON.parse(JSON.stringify(wire)))
  expect(restored).toEqual(original)
  expect(restored.words[0].dictionary?.contentVersion).toBe('9007199254740993')
  expect(restored.dictionaryWatermark).toBe('9007199254740994')
})

it('keeps distinct personal versions, adopted revisions and CEFR descriptors separate', () => {
  const data = dataFor()
  const first = data.words[0].dictionary!
  if (!('protocolVersion' in first))
    throw new Error('Expected protocol2 metadata')
  data.words[1].dictionary = { ...first, contentVersion: '9007199254740995' }
  data.words[2].dictionary = {
    ...first,
    cefr: { ...first.cefr, confidence: 0.5 },
  }
  data.words[3].dictionary = {
    ...first,
    protocolVersion: 2,
    mode: 'legacy',
    source: 'pinned',
    contentVersion: '9007199254740993',
    adoptedRevisionId: first.reference!.revision_id,
    headSequence: null,
    watermark: '9007199254740994',
  }
  const wire = serializeReviewWorkspace(data)
  if (!('serializedReviewWorkspace' in wire))
    throw new Error('Expected serialized data')
  expect(
    JSON.parse(wire.serializedReviewWorkspace).dictionaryMetadata
  ).toHaveLength(4)
  expect(deserializeReviewWorkspace(wire)).toEqual(data)
})

it('does not alias metadata between words or the wire after restoration and session preparation', async () => {
  const original = dataFor()
  const wire = serializeReviewWorkspace(original)
  const restored = deserializeReviewWorkspace(wire)
  const controller = createReviewSessionController(
    'synthetic-owner',
    restored,
    jest.fn(async input => successfulResult(input.wordId)),
    { submit: jest.fn(), refresh: jest.fn() }
  )
  controller.attach()
  try {
    expect(
      await controller.start('all-due', null, 'meaning-recall', false)
    ).toBe('started')
    const active = controller.getSnapshot().flow!.active!
    restored.words[0].dictionary!.cefr.status = 'unknown'
    restored.words[0].dictionary!.reference!.revision_id =
      '33333333-3333-4333-8333-333333333333'
    expect(restored.words[1].dictionary).toEqual(original.words[1].dictionary)
    expect(original.words[0].dictionary?.cefr.status).toBe('reviewed')
    expect(active.question.payload.word.dictionary?.cefr.status).toBe(
      'reviewed'
    )
    expect(active.question.payload.word.dictionary?.reference).toEqual(
      original.words[0].dictionary?.reference
    )
  } finally {
    controller.detach()
  }
})

it.each([-1, 0.5, 4])(
  'rejects a malformed internal dictionary index %s',
  dictionaryIndex => {
    const wire = serializeReviewWorkspace(dataFor())
    if (!('serializedReviewWorkspace' in wire))
      throw new Error('Expected serialized data')
    const indexed = JSON.parse(wire.serializedReviewWorkspace)
    expect(() =>
      deserializeReviewWorkspace({
        serializedReviewWorkspace: JSON.stringify({
          ...indexed,
          words: [[...indexed.words[0].slice(0, -1), dictionaryIndex]],
        }),
      })
    ).toThrow('metadata index')
  }
)

it('leaves snapshot1 and existing snapshot2 paths unchanged', () => {
  const data = { ...dataFor(), dictionaryWatermark: undefined }
  expect(serializeReviewWorkspace(data)).toBe(data)
  expect(deserializeReviewWorkspace(data)).toBe(data)
})

it('preserves heterogeneous personal fields and words without dictionary metadata', () => {
  const original = dataFor(2)
  original.words[0] = {
    article: 'het',
    collectionId: 'private-collection',
    dutchLemma: 'woord',
    dutchOriginal: 'het woord',
    easinessFactor: 1.7,
    id: 'private-word',
    imageUrl: 'https://example.invalid/image.png',
    intervalDays: 17,
    lastReviewedAt: '2026-09-01T08:00:00Z',
    nextReviewDate: '2026-10-11',
    partOfSpeech: 'noun',
    repetitionCount: 8,
    translations: { en: ['word'], ru: ['слово'] },
    ttsUrl: 'https://example.invalid/speech.mp3',
  }
  const wire = serializeReviewWorkspace(original)
  expect(deserializeReviewWorkspace(wire)).toEqual(original)
  if (!('serializedReviewWorkspace' in wire))
    throw new Error('Expected serialized data')
  const indexed = JSON.parse(wire.serializedReviewWorkspace)
  expect(indexed.words[0]).toHaveLength(15)
  expect(indexed.words[0][14]).toBeNull()
  expect(() =>
    deserializeReviewWorkspace({
      serializedReviewWorkspace: JSON.stringify({
        ...indexed,
        words: [indexed.words[0].slice(1)],
      }),
    })
  ).toThrow('word tuple')
})

it('round-trips JSON text, Unicode, nulls and events without interpreting RSC-like strings', () => {
  const original = dataFor()
  original.words[0].dutchLemma = '$L1 <script> \\" \\n café 🚲'
  original.words[0].translations = {
    en: ['$undefined', '$NaN', '</script>'],
    ru: ['слово'],
  }
  original.words[1].translations = null
  original.events = [
    {
      eventId: 'event',
      wordId: original.words[0].id,
      assessment: 'good',
      reviewMode: 'meaning-recall',
      answeredCorrectly: null,
      reviewedAt: '2026-10-11T12:00:00.000Z',
    },
  ]
  expect(
    deserializeReviewWorkspace(serializeReviewWorkspace(original))
  ).toEqual(original)
  expect(() =>
    deserializeReviewWorkspace({ serializedReviewWorkspace: '{broken' })
  ).toThrow()
})
