import {
  parseDictionaryImportIntentV2,
  parseDictionaryImportReceiptV2,
  parseDictionaryCollectionExportV2,
  parseSharedDictionaryCollectionV2,
  parseDictionaryCacheBatchV2,
  parseDictionaryImportIntent,
  parseDictionaryImportRecoveryV2,
  parseDictionaryImportRecoveryResultV2,
  parseDictionaryImportRecoveryStateV2,
  parseDictionaryImportCancellationV2,
  parseDictionaryImportCancellationReceiptV2,
  type DictionaryContent,
} from '@woordenaar/domain'
const id = '11111111-1111-4111-8111-111111111111'
const next = '22222222-2222-4222-8222-222222222222'
const digest = 'a'.repeat(64)
const reference = { entry_id: id, revision_id: id }
const content: DictionaryContent = {
  dutch_lemma: 'fiets',
  dutch_original: 'fiets',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['bicycle'], ru: [] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: null,
  register: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
const source = {
  kind: 'published-reference',
  reference,
  content_sha256: digest,
}
const input = {
  protocol_version: 2,
  operation_id: id,
  word_id: id,
  collection_id: id,
  source,
}
const intent = parseDictionaryImportIntentV2(input)
const receipt = {
  protocol_version: 2,
  operation_id: id,
  word_id: id,
  idempotent: false,
  outcome: 'inserted',
  existing_word_id: null,
  reference,
  applied_reference: { entry_id: id, revision_id: next },
  applied_head_sequence: '9007199254740993',
}
const revision = {
  revision_id: id,
  entry_id: id,
  revision_no: 1,
  schema_version: 1,
  content,
  content_sha256: digest,
  cefr_input_sha256: digest,
  review_status: 'published',
}
const transfer = {
  content,
  shared_reference: { reference, content_sha256: digest },
}
const batch = {
  protocol_version: 2,
  resolutions: [
    {
      cache_id: id,
      status: 'resolved',
      reference,
      head_sequence: '9007199254740993',
    },
  ],
  revisions: [revision],
}
describe('following imports, portable references and trusted cache contracts', () => {
  it('binds explicit follow recovery/cancellation to immutable protocol2 roots and placement/version CAS', () => {
    const request = {
      protocol_version: 2,
      operation_id: next,
      original_intent: input,
      expected_recovery_version: 0,
      expected_collection_id: id,
      target_collection_id: next,
    }
    const parsed = parseDictionaryImportRecoveryV2(request)
    expect(parsed).toEqual(request)
    const result = {
      protocol_version: 2,
      operation_id: next,
      original_operation_id: id,
      word_id: id,
      target_collection_id: next,
      outcome: 'applied',
      existing_word_id: null,
      recovery_version: 1,
      idempotent: false,
    }
    expect(parseDictionaryImportRecoveryResultV2(result, parsed)).toEqual(
      result
    )
    for (const update of [
      { protocol_version: 1 },
      { original_intent: { ...input, protocol_version: 1 } },
      { repetition_count: 9 },
      { expected_recovery_version: -1 },
      { operation_id: id },
    ])
      expect(() =>
        parseDictionaryImportRecoveryV2({ ...request, ...update })
      ).toThrow()
    expect(() =>
      parseDictionaryImportRecoveryResultV2(
        { ...result, recovery_version: 2 },
        parsed
      )
    ).toThrow()
    const cancellation = {
        protocol_version: 2,
        operation_id: next,
        original_intent: input,
      },
      cancel = parseDictionaryImportCancellationV2(cancellation)
    const receipt = {
      protocol_version: 2,
      operation_id: next,
      original_operation_id: id,
      word_id: id,
      outcome: 'cancelled',
      recovery_version: 1,
      idempotent: false,
    }
    expect(parseDictionaryImportCancellationReceiptV2(receipt, cancel)).toEqual(
      receipt
    )
    expect(() =>
      parseDictionaryImportCancellationReceiptV2(
        { ...receipt, word_id: next },
        cancel
      )
    ).toThrow()
  })
  it('keeps recovery state distinct from active learning and rejects inconsistent unavailable/cancelled snapshots', () => {
    const state = {
      protocol_version: 2,
      original_operation_id: id,
      word_id: id,
      recovery_version: 0,
      inserted_once: false,
      state: 'uncreated',
      collection_id: null,
    }
    expect(parseDictionaryImportRecoveryStateV2(state, intent)).toEqual(state)
    for (const update of [
      { state: 'active' },
      { state: 'cancelled' },
      { inserted_once: true },
      { collection_id: id },
      { repetition_count: 9 },
    ])
      expect(() =>
        parseDictionaryImportRecoveryStateV2({ ...state, ...update }, intent)
      ).toThrow()
  })
  it('accepts published, immutable official and explicitly shared sources without private analysis input', () => {
    for (const s of [
      source,
      {
        ...source,
        kind: 'official-pack',
        pack_id: 'pack',
        version: '1',
        pack_entry_id: 'entry',
        manifest_sha256: digest,
      },
      { ...source, kind: 'shared-collection', share_token: id, word_id: next },
    ])
      expect(
        parseDictionaryImportIntentV2({ ...input, source: s }).source
      ).toEqual(s)
  })
  it.each([
    { ...input, protocol_version: 1 },
    { ...input, user_id: id },
    { ...input, repetition_count: 8 },
    { ...input, source: { ...source, content } },
    { ...input, source: { kind: 'private-copy', content } },
    { ...input, source: { ...source, content_sha256: 'bad' } },
    { ...input, source: { ...source, reference: null } },
    {
      ...input,
      source: { ...source, reference: { ...reference, sense_key: 'guess' } },
    },
    {
      ...input,
      source: {
        ...source,
        kind: 'official-pack',
        pack_id: 'pack',
        version: '1',
        pack_entry_id: 'entry',
        manifest_sha256: null,
      },
    },
  ])('rejects injected, unresolved or unbound new import input %p', value =>
    expect(() => parseDictionaryImportIntentV2(value)).toThrow()
  )
  it('keeps immutable version1 queued import parsing separate', () => {
    const legacy = {
      ...input,
      protocol_version: 1,
      source: { kind: 'private-copy', content },
    }
    expect(parseDictionaryImportIntent(legacy)).toEqual(legacy)
    expect(() => parseDictionaryImportIntent(input)).toThrow()
    expect(() => parseDictionaryImportIntentV2(legacy)).toThrow()
  })
  it('binds adopted entry, applied head and decimal sequence independently of revision order', () => {
    expect(parseDictionaryImportReceiptV2(receipt, intent)).toEqual(receipt)
    for (const fields of [
      { word_id: next },
      { reference: { entry_id: id, revision_id: next } },
      { applied_reference: { entry_id: next, revision_id: next } },
      { applied_head_sequence: 9007199254740993 },
      { applied_head_sequence: '01' },
      { outcome: 'published' },
    ])
      expect(() =>
        parseDictionaryImportReceiptV2({ ...receipt, ...fields }, intent)
      ).toThrow()
    const conflict = {
      ...receipt,
      outcome: 'identity-conflict',
      existing_word_id: next,
      reference: null,
      applied_reference: null,
      applied_head_sequence: null,
    }
    expect(parseDictionaryImportReceiptV2(conflict, intent)).toEqual(conflict)
    expect(() =>
      parseDictionaryImportReceiptV2({ ...conflict, reference }, intent)
    ).toThrow()
  })
  it('preserves portable private originals as explicit unresolved snapshots, without owner learning/history', () => {
    const exported = {
      schema_version: 2,
      collection: { name: 'Portable' },
      entries: [transfer, { content, shared_reference: null }],
    }
    expect(parseDictionaryCollectionExportV2(exported)).toEqual(exported)
    const shared = {
      schema_version: 2,
      collection: { collection_id: id, name: 'Shared' },
      words: [{ ...transfer, word_id: id }],
    }
    expect(parseSharedDictionaryCollectionV2(shared)).toEqual(shared)
    expect(() =>
      parseSharedDictionaryCollectionV2({
        ...shared,
        words: [...shared.words, ...shared.words],
      })
    ).toThrow()
    for (const field of [
      { user_id: id },
      { repetition_count: 8 },
      { operation_id: id },
    ])
      expect(() =>
        parseDictionaryCollectionExportV2({
          ...exported,
          entries: [{ ...transfer, ...field }],
        })
      ).toThrow()
  })
  it('requires deduplicated published dependencies for every resolved cache hint', () => {
    expect(parseDictionaryCacheBatchV2(batch)).toEqual(batch)
    for (const update of [
      { revisions: [] },
      { revisions: [revision, revision] },
      { resolutions: [...batch.resolutions, ...batch.resolutions] },
      { revisions: [{ ...revision, review_status: 'draft' }] },
      { revisions: [{ ...revision, entry_id: next }] },
      { resolutions: [{ ...batch.resolutions[0], head_sequence: 3 }] },
    ])
      expect(() =>
        parseDictionaryCacheBatchV2({ ...batch, ...update })
      ).toThrow()
    expect(() =>
      parseDictionaryCacheBatchV2({ ...batch, resolutions: [] })
    ).toThrow()
  })
  it('missing, stale, unmapped and unavailable cache rows carry no usable reference', () => {
    for (const status of [
      'missing',
      'unmapped',
      'expired',
      'unavailable',
      'mapping-mismatch',
    ]) {
      const value = {
        protocol_version: 2,
        resolutions: [
          { cache_id: id, status, reference: null, head_sequence: null },
        ],
        revisions: [],
      }
      expect(parseDictionaryCacheBatchV2(value)).toEqual(value)
      expect(() =>
        parseDictionaryCacheBatchV2({
          ...value,
          resolutions: [{ ...value.resolutions[0], reference }],
        })
      ).toThrow()
    }
    expect(() =>
      parseDictionaryCacheBatchV2({
        ...batch,
        resolutions: Array(501).fill(batch.resolutions[0]),
      })
    ).toThrow()
  })
})
