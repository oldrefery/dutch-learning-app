import {
  compareDictionarySequences,
  parseDictionaryChangePageV2,
  parseDictionaryEffectiveBatchV2,
  parseDictionaryFollowingCapability,
  parseDictionarySequence,
  parseDictionaryReadContent,
  parseDictionaryRevision,
  resolveFollowingDictionaryContent,
  type DictionaryContent,
} from '@woordenaar/domain'

const entry = '11111111-1111-4111-8111-111111111111'
const revision = '22222222-2222-4222-8222-222222222222'
const adopted = '33333333-3333-4333-8333-333333333333'
const word = '44444444-4444-4444-8444-444444444444'
const secondWord = '55555555-5555-4555-8555-555555555555'
const cefr = { level: null, status: 'unknown', confidence: null }
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
  plural: 'fietsen',
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
const dependency = {
  revision_id: revision,
  entry_id: entry,
  revision_no: 2,
  schema_version: 1,
  content,
  content_sha256: 'a'.repeat(64),
  cefr_input_sha256: 'b'.repeat(64),
  review_status: 'published',
}
const card = {
  word_id: word,
  mode: 'follow',
  content_version: '7',
  reference: { entry_id: entry, revision_id: revision },
  adopted_revision_id: adopted,
  head_sequence: '9007199254740993',
  legacy_content: null,
  removed_fields: [],
  cefr,
}
const batch = () => ({
  protocol_version: 2,
  watermark: '9007199254740993',
  cards: [card, { ...card, word_id: secondWord }],
  revisions: [dependency],
})
const change = (cursor: string) => ({
  cursor,
  kind: 'revision-head',
  entry_id: entry,
  revision_id: revision,
  assessment_id: null,
})
const page = () => ({
  protocol_version: 2,
  after: '9007199254740991',
  next_cursor: '9007199254740993',
  latest_cursor: '9007199254740993',
  has_more: false,
  changes: [change('9007199254740992'), change('9007199254740993')],
})

it('orders A15 decimal sequences without rounding at the JavaScript safe integer boundary', () => {
  expect(
    compareDictionarySequences('9007199254740992', '9007199254740993')
  ).toBe(-1)
  expect(compareDictionarySequences('10', '9')).toBe(1)
  expect(
    compareDictionarySequences('9223372036854775807', '9223372036854775807')
  ).toBe(0)
  expect(parseDictionarySequence('0')).toEqual({ success: true, data: '0' })
  expect(parseDictionaryChangePageV2(page(), '9007199254740991').success).toBe(
    true
  )
})

it.each([
  0,
  9007199254740992,
  '-1',
  '01',
  '+1',
  '1.0',
  '1e3',
  ' 1',
  '1\n',
  '1\r',
  '1\u2028',
  '1\u2029',
  '9223372036854775807\n',
  '9223372036854775808',
  '',
  null,
])('rejects noncanonical or overflowing sequences: %p', value => {
  expect(parseDictionarySequence(value).success).toBe(false)
})

it('rejects a malformed comparison argument instead of coercing it', () => {
  expect(() => compareDictionarySequences('01', '1')).toThrow('canonical')
})

const expectIntegerOrder = (left: bigint, right: bigint) => {
  expect(compareDictionarySequences(left.toString(), right.toString())).toBe(
    left < right ? -1 : left > right ? 1 : 0
  )
}

it('matches integer ordering across decimal lengths and the full signed BIGINT range', () => {
  const maximum = 9223372036854775807n
  const boundaries = [0n, 1n, 9007199254740991n, maximum - 1n, maximum]
  for (let digits = 1; digits < 19; digits += 1) {
    const power = 10n ** BigInt(digits)
    boundaries.push(power - 1n, power, power + 1n)
  }
  for (const left of boundaries) {
    expect(parseDictionarySequence(left.toString()).success).toBe(true)
    for (const right of boundaries) {
      expectIntegerOrder(left, right)
    }
  }
  let state = 20261023n
  for (let index = 0; index < 2048; index += 1) {
    const left = state
    state = (state * 6364136223846793005n + 1n) % (maximum + 1n)
    expectIntegerOrder(left, state)
  }
  for (const value of [maximum + 1n, 9999999999999999999n, 10n ** 19n]) {
    expect(parseDictionarySequence(value.toString()).success).toBe(false)
    expect(() => compareDictionarySequences('0', value.toString())).toThrow()
  }
})

it('resolves two following cards through one deduplicated current dependency and preserves adoption provenance', () => {
  const result = parseDictionaryEffectiveBatchV2(batch())
  expect(result.success).toBe(true)
  if (!result.success) throw new Error('Expected valid batch')
  expect(result.data.cards[0].adopted_revision_id).toBe(adopted)
  expect(result.data.revisions).toHaveLength(1)
  expect(resolveFollowingDictionaryContent(result.data, word)).toEqual(content)
  expect(resolveFollowingDictionaryContent(result.data, secondWord)).toEqual(
    content
  )
  expect(
    resolveFollowingDictionaryContent(result.data, adopted)
  ).toBeUndefined()
})

it('rejects A14 missing dependencies, foreign meaning identity and unpublished content before cache acknowledgement', () => {
  for (const revisions of [
    [],
    [dependency, dependency],
    [{ ...dependency, entry_id: adopted }],
    [{ ...dependency, review_status: 'draft' }],
    [{ ...dependency, review_status: 'retired' }],
  ]) {
    expect(
      parseDictionaryEffectiveBatchV2({ ...batch(), revisions }).success
    ).toBe(false)
  }
  expect(
    parseDictionaryEffectiveBatchV2({
      ...batch(),
      revisions: [dependency, { ...dependency, revision_id: adopted }],
    }).success
  ).toBe(false)
})

it('rejects following private overlays, future head sequences and personal learning fields', () => {
  for (const changed of [
    { legacy_content: content },
    { removed_fields: ['image_url'] },
    { head_sequence: '9007199254740994' },
    { reference: null },
    { adopted_revision_id: null },
    { interval_days: 9 },
    { head_sequence: '0' },
    { content_version: 7 },
  ]) {
    expect(
      parseDictionaryEffectiveBatchV2({
        ...batch(),
        cards: [{ ...card, ...changed }],
      }).success
    ).toBe(false)
  }
  expect(
    parseDictionaryEffectiveBatchV2({ ...batch(), cards: [card, card] }).success
  ).toBe(false)
})

it('keeps legacy private omissions readable while preserving explicit legacy mode', () => {
  const result = parseDictionaryEffectiveBatchV2({
    protocol_version: 2,
    watermark: '1',
    revisions: [],
    cards: [
      {
        ...card,
        mode: 'legacy',
        reference: null,
        adopted_revision_id: null,
        head_sequence: null,
        legacy_content: { ...content, dutch_original: '' },
      },
    ],
  })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error('Expected valid legacy batch')
  expect(
    resolveFollowingDictionaryContent(result.data, word)?.dutch_original
  ).toBe('')
})

it('preserves legacy pin identity and raw effective omissions without weakening published dependencies', () => {
  const legacy = {
    ...card,
    mode: 'legacy',
    adopted_revision_id: revision,
    head_sequence: null,
    legacy_content: { ...content, analysis_notes: 'Private legacy note' },
    removed_fields: ['image_url'],
  }
  const value = { ...batch(), cards: [legacy] }
  expect(parseDictionaryEffectiveBatchV2(value).success).toBe(true)
  expect(
    parseDictionaryEffectiveBatchV2({
      ...value,
      cards: [{ ...legacy, adopted_revision_id: adopted }],
    }).success
  ).toBe(false)
  expect(
    parseDictionaryEffectiveBatchV2({
      ...value,
      cards: [
        { ...legacy, legacy_content: { ...content, dutch_original: '' } },
      ],
    }).success
  ).toBe(true)
  expect(
    parseDictionaryRevision({
      ...dependency,
      content: { ...content, dutch_original: '' },
    }).success
  ).toBe(false)
})

it('preserves legacy removals/private JSON but rejects unmarked removals and personal fields', () => {
  const legacyContent = {
    ...content,
    translations: null,
    examples: null,
    synonyms: null,
    is_irregular: null,
    analysis_notes: '',
    usage_notes: { old_private_format: 'Retain for legacy reads' },
  }
  const legacy = {
    ...card,
    mode: 'legacy',
    reference: null,
    adopted_revision_id: null,
    head_sequence: null,
    legacy_content: legacyContent,
    removed_fields: ['translations', 'examples', 'synonyms', 'is_irregular'],
  }
  const result = parseDictionaryEffectiveBatchV2({
    ...batch(),
    cards: [legacy],
    revisions: [],
  })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error('Expected legacy removal projection')
  expect(resolveFollowingDictionaryContent(result.data, word)).toEqual(
    legacyContent
  )
  expect(
    parseDictionaryEffectiveBatchV2({
      ...batch(),
      cards: [{ ...legacy, removed_fields: ['plural'] }],
      revisions: [],
    }).success
  ).toBe(false)
  expect(
    parseDictionaryReadContent({ ...legacyContent, repetition_count: 99 })
      .success
  ).toBe(false)
  expect(
    parseDictionaryRevision({ ...dependency, content: legacyContent }).success
  ).toBe(false)
})

it('checks capability versions and behavior flags independently without reinterpreting v1', () => {
  const capability = {
    dictionary_content_protocol: 2,
    read_protocol_versions: [1, 2],
    command_protocol_versions: [1],
    following_enabled: true,
    shared_analysis_enabled: false,
  }
  expect(parseDictionaryFollowingCapability(capability).success).toBe(true)
  expect(
    parseDictionaryFollowingCapability({ dictionary_content_protocol: 1 })
      .success
  ).toBe(false)
  expect(
    parseDictionaryFollowingCapability({
      ...capability,
      read_protocol_versions: [1],
    }).success
  ).toBe(false)
  expect(
    parseDictionaryFollowingCapability({
      ...capability,
      shared_analysis_enabled: true,
    }).success
  ).toBe(false)
  expect(
    parseDictionaryFollowingCapability({
      ...capability,
      command_protocol_versions: [1, 1],
    }).success
  ).toBe(false)
})

it('rejects gaps, out-of-order or replay-mismatched page cursors and contradictory terminal pages', () => {
  for (const changed of [
    { next_cursor: '9007199254740992' },
    { changes: [...page().changes].reverse() },
    { has_more: true },
    { changes: [], has_more: true },
    { after: '9007199254740993' },
    { latest_cursor: '9007199254740992' },
    { changes: [{ ...change('9007199254740993'), assessment_id: adopted }] },
  ]) {
    expect(
      parseDictionaryChangePageV2({ ...page(), ...changed }, page().after)
        .success
    ).toBe(false)
  }
  expect(
    parseDictionaryChangePageV2({
      ...page(),
      after: '9007199254740993',
      changes: [],
    }).success
  ).toBe(true)
})

it('accepts a bounded full review library above the per-request ID limit and rejects an oversized snapshot', () => {
  const cards = Array.from({ length: 1001 }, (_, index) => ({
    ...card,
    word_id: `${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`,
  }))
  expect(parseDictionaryEffectiveBatchV2({ ...batch(), cards }).success).toBe(
    true
  )
  expect(
    parseDictionaryEffectiveBatchV2({
      ...batch(),
      cards: Array(10001).fill(card),
    }).success
  ).toBe(false)
})
