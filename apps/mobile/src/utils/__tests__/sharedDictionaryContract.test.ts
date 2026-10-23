import {
  canonicalizeCefrInput,
  DICTIONARY_CONTENT_PROTOCOL_VERSION,
  parseDictionaryCefrAssessment,
  parseDictionaryContent,
  parsePrivateDictionaryContent,
  parseDictionaryContentCommand,
  parseDictionaryContentOverrides,
  parseDictionaryEntry,
  parseDictionaryReference,
  parseDictionaryRevision,
  resolveEffectiveDictionaryContent,
  resolveInheritedCefr,
  type DictionaryContent,
  type DictionaryRevision,
} from '@woordenaar/domain'

const unknownFieldMessage = 'is not allowed'
const entryId = '11111111-1111-4111-8111-111111111111'
const revisionId = '22222222-2222-4222-8222-222222222222'
const assessmentId = '33333333-3333-4333-8333-333333333333'
const operationId = '44444444-4444-4444-8444-444444444444'
const wordId = '55555555-5555-4555-8555-555555555555'
const digest = (value: string) => value.repeat(64)

const content = (): DictionaryContent => ({
  dutch_lemma: 'fiets',
  dutch_original: 'fiets',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['bicycle'], ru: ['велосипед'] },
  examples: [
    { nl: 'Mijn fiets is blauw.', en: 'My bicycle is blue.', ru: null },
  ],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'fietsen',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: 'https://example.invalid/fiets.png',
  tts_url: 'https://example.invalid/fiets.mp3',
})

const reference = () => ({ entry_id: entryId, revision_id: revisionId })
const revision = (): DictionaryRevision => ({
  revision_id: revisionId,
  entry_id: entryId,
  revision_no: 1,
  schema_version: 1,
  content: content(),
  content_sha256: digest('a'),
  cefr_input_sha256: digest('b'),
  review_status: 'published',
})

describe('shared dictionary contract', () => {
  it('keeps missing and unknown field diagnostics stable across repeated reads', () => {
    const invalid = { ...content(), unexpected: true }
    Reflect.deleteProperty(invalid, 'article')
    const expected = {
      success: false,
      issues: expect.arrayContaining([
        { path: 'content.unexpected', message: unknownFieldMessage },
        { path: 'content.article', message: 'is required' },
      ]),
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(parseDictionaryContent(invalid)).toEqual(expected)
      expect(parseDictionaryContent(content()).success).toBe(true)
      expect(
        parseDictionaryReference({ entry_id: entryId, extra: true })
      ).toEqual({
        success: false,
        issues: expect.arrayContaining([
          { path: 'reference.extra', message: unknownFieldMessage },
          { path: 'reference.revision_id', message: 'is required' },
        ]),
      })
    }
  })

  it('returns independent nested content for repeated reads of the same revision', () => {
    const input = revision()
    const first = parseDictionaryRevision(input)
    const second = parseDictionaryRevision(input)
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success)
      throw new Error('Expected valid revisions')
    first.data.content.translations.en.push('changed')
    first.data.content.examples[0].nl = 'changed'
    expect(second.data).toEqual(input)
    expect(parseDictionaryRevision(input)).toEqual(second)
  })

  it('reads historical private omissions without weakening canonical content or mutating the input', () => {
    const legacy = {
      ...content(),
      dutch_original: '',
      analysis_notes: '  ',
      tts_url: '',
      conjugation: {
        present: 'loop',
        simple_past: 'liep',
        past_participle: 'gelopen',
      },
      examples: [{ nl: 'Ik loop.', en: 'I walk.' }],
    }
    const before = JSON.stringify(legacy)
    expect(parseDictionaryContent(legacy).success).toBe(false)
    expect(parsePrivateDictionaryContent(legacy)).toEqual({
      success: true,
      data: {
        ...legacy,
        dutch_original: null,
        analysis_notes: null,
        tts_url: null,
        conjugation: { ...legacy.conjugation, simple_past_plural: null },
        examples: [{ ...legacy.examples[0], ru: null }],
      },
    })
    expect(JSON.stringify(legacy)).toBe(before)
  })

  it('preserves incomplete private separable metadata but rejects authoring it as new canonical content', () => {
    const legacy = {
      ...content(),
      is_separable: true,
      prefix_part: null,
      root_verb: null,
    }
    expect(parsePrivateDictionaryContent(legacy)).toEqual({
      success: true,
      data: legacy,
    })
    expect(parseDictionaryContent(legacy).success).toBe(false)
    expect(
      parseDictionaryContentCommand({
        protocol_version: 1,
        operation_id: operationId,
        word_id: wordId,
        expected_content_version: 0,
        kind: 'create-private',
        content: legacy,
      }).success
    ).toBe(false)
    expect(
      parseDictionaryRevision({ ...revision(), content: legacy }).success
    ).toBe(false)
  })

  it('keeps type checks and unknown-field rejection at the private read boundary', () => {
    for (const legacy of [
      { ...content(), private_note: 'unexpected' },
      { ...content(), examples: [{ nl: 'Hoi', en: 'Hello', ru: 42 }] },
      {
        ...content(),
        conjugation: {
          present: 'loop',
          simple_past: 'liep',
          past_participle: 'gelopen',
          simple_past_plural: 42,
        },
      },
      { ...content(), translations: { en: [], ru: [] } },
    ])
      expect(parsePrivateDictionaryContent(legacy).success).toBe(false)
  })

  it('strictly validates content, identities, revisions, and reference pairs', () => {
    expect(parseDictionaryContent(content())).toEqual({
      success: true,
      data: content(),
    })
    expect(
      parseDictionaryContent({ ...content(), private_note: 'never publish' })
    ).toMatchObject({
      success: false,
      issues: [{ path: 'content.private_note', message: unknownFieldMessage }],
    })
    expect(
      parseDictionaryContent({ ...content(), is_separable: true })
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: 'content.prefix_part' }),
        expect.objectContaining({ path: 'content.root_verb' }),
      ]),
    })
    expect(
      parseDictionaryEntry({
        entry_id: entryId,
        language_code: 'nl',
        lemma: 'fiets',
        part_of_speech: 'noun',
        article: 'de',
        sense_key: 'bicycle',
        state: 'published',
      })
    ).toMatchObject({ success: true })
    expect(parseDictionaryReference({ entry_id: entryId })).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: 'reference.revision_id' }),
      ]),
    })
    expect(parseDictionaryRevision(revision())).toMatchObject({ success: true })
    expect(
      parseDictionaryRevision({ ...revision(), schema_version: 2 })
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: 'revision.schema_version' }),
      ]),
    })
  })

  it('applies only explicit valid overrides and preserves removal separately from absence', () => {
    const overrides = parseDictionaryContentOverrides({
      examples: { op: 'remove' },
      translations: { op: 'set', value: { en: ['bike'], ru: [] } },
    })
    expect(overrides).toMatchObject({ success: true })
    if (!overrides.success) throw new Error('Expected valid overrides')

    const resolved = resolveEffectiveDictionaryContent({
      reference: reference(),
      revision: revision(),
      fallback_content: null,
      overrides: overrides.data,
    })
    expect(resolved).toMatchObject({
      source: 'pinned',
      removed_fields: ['examples'],
      content: { examples: null, translations: { en: ['bike'], ru: [] } },
    })
    expect(
      parseDictionaryContentOverrides({
        translations: { op: 'set', value: { en: [], ru: [] } },
      })
    ).toMatchObject({ success: false })
    expect(
      resolveEffectiveDictionaryContent({
        reference: null,
        revision: null,
        fallback_content: null,
        overrides: {},
      })
    ).toEqual({ source: 'missing', content: null, removed_fields: [] })
  })

  it('inherits CEFR only for an exact pinned input without private linguistic edits', () => {
    const assessment = parseDictionaryCefrAssessment({
      assessment_id: assessmentId,
      entry_id: entryId,
      input_sha256: digest('b'),
      cefr_level: 'A2',
      status: 'reviewed',
      confidence: 0.9,
      method: 'editorial',
      method_version: '1',
      locked: true,
      supersedes_assessment_id: null,
    })
    expect(assessment).toMatchObject({ success: true })
    if (!assessment.success) throw new Error('Expected valid assessment')

    expect(
      resolveInheritedCefr({
        reference: reference(),
        revision: revision(),
        overrides: {
          image_url: { op: 'set', value: 'https://example.invalid/new.png' },
        },
        assessment: assessment.data,
      })
    ).toEqual({ level: 'A2', status: 'reviewed', reason: 'inherited' })
    expect(
      resolveInheritedCefr({
        reference: reference(),
        revision: revision(),
        overrides: {
          translations: { op: 'set', value: { en: ['cycle'], ru: [] } },
        },
        assessment: assessment.data,
      })
    ).toEqual({
      level: null,
      status: 'unknown',
      reason: 'private-linguistic-override',
    })
    expect(
      resolveInheritedCefr({
        reference: reference(),
        revision: { ...revision(), cefr_input_sha256: digest('c') },
        overrides: {},
        assessment: assessment.data,
      })
    ).toEqual({
      level: null,
      status: 'unknown',
      reason: 'assessment-input-mismatch',
    })
  })

  it('canonicalizes linguistic input without media and only accepts versioned commands', () => {
    const withoutMedia = content()
    const changedMedia = {
      ...content(),
      image_url: 'https://example.invalid/other.png',
    }
    expect(canonicalizeCefrInput(withoutMedia)).toBe(
      canonicalizeCefrInput(changedMedia)
    )
    expect(canonicalizeCefrInput(withoutMedia)).not.toBe(
      canonicalizeCefrInput({ ...withoutMedia, plural: 'fietsjes' })
    )
    expect(
      parseDictionaryContentCommand({
        protocol_version: DICTIONARY_CONTENT_PROTOCOL_VERSION,
        operation_id: operationId,
        word_id: wordId,
        expected_content_version: 0,
        kind: 'link',
        reference: reference(),
        overrides: {},
      })
    ).toMatchObject({ success: true })
    expect(
      parseDictionaryContentCommand({
        protocol_version: 2,
        operation_id: operationId,
        word_id: wordId,
        expected_content_version: 0,
        kind: 'detach',
        content: content(),
        user_id: entryId,
      })
    ).toMatchObject({ success: false })
  })
})
