import {
  parseDictionaryEntryHistoryV2,
  parseDictionaryRevisionDiffV2,
  parseDictionaryRollbackAuditV2,
  parseDictionaryRollbackCommandV2,
  parseDictionaryRollbackReceiptV2,
  type DictionaryRollbackCommandV2,
  type DictionaryContent,
} from '@woordenaar/domain'

const entry = '11111111-1111-4111-8111-111111111111',
  old = '22222222-2222-4222-8222-222222222222',
  current = '33333333-3333-4333-8333-333333333333',
  operation = '44444444-4444-4444-8444-444444444444'
const hash = 'a'.repeat(64),
  otherHash = 'b'.repeat(64)
const command: DictionaryRollbackCommandV2 = {
  protocol_version: 2,
  operation_id: operation,
  entry_id: entry,
  expected_revision_id: current,
  expected_head_sequence: '9007199254740993',
  target_revision_id: old,
  reason: 'Restore reviewed content.',
}
const receipt = {
  ...command,
  outcome: 'reverted',
  applied_revision_id: old,
  applied_head_sequence: '9007199254741000',
  idempotent: false,
}
const content: DictionaryContent = {
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['financial institution'], ru: ['банк'] },
  examples: [
    {
      nl: 'Ik heb geld bij de bank.',
      en: 'I have money at the bank.',
      ru: null,
    },
  ],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'banken',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
const event = (sequence: string, revisionId: string, revisionNo: number) => ({
  head_sequence: sequence,
  revision_id: revisionId,
  revision_no: revisionNo,
  content_sha256: hash,
  changed_at: '2026-10-10T11:00:00+02:00',
  kind: 'head',
})
const page = {
  protocol_version: 2,
  entry_id: entry,
  current_revision_id: old,
  current_head_sequence: '9007199254741000',
  events: [
    { ...event('9007199254741000', old, 1), kind: 'rollback' },
    event('9007199254740993', current, 2),
    event('9007199254740988', old, 1),
  ],
  next_before: null,
}
const nextContent = {
  ...content,
  image_url: 'https://media.example.invalid/public/dictionary/bank.jpg',
  usage_notes: { summary: 'Financial institutions.', contrasts: [] },
}
const diff = {
  protocol_version: 2,
  entry_id: entry,
  from_revision_id: old,
  to_revision_id: current,
  from_content: content,
  to_content: nextContent,
  from_content_sha256: hash,
  to_content_sha256: otherHash,
  changes: [
    { field: 'image_url', before: null, after: nextContent.image_url },
    { field: 'usage_notes', before: null, after: nextContent.usage_notes },
  ],
}
describe('shared history/diff and administrator rollback contracts', () => {
  it('keeps decimal event sequences exact, binds every rollback field and permits immutable replay', () => {
    expect(parseDictionaryRollbackCommandV2(command).success).toBe(true)
    expect(parseDictionaryRollbackReceiptV2(receipt, command)).toMatchObject({
      success: true,
      data: receipt,
    })
    expect(
      parseDictionaryRollbackReceiptV2(
        { ...receipt, idempotent: true },
        command
      ).success
    ).toBe(true)
    for (const patch of [
      { operation_id: old },
      { entry_id: old },
      { target_revision_id: current },
      { expected_head_sequence: '3' },
      { reason: 'Changed reason' },
    ])
      expect(
        parseDictionaryRollbackReceiptV2({ ...receipt, ...patch }, command)
          .success
      ).toBe(false)
  })
  it.each([
    { actor_id: entry },
    { repetition_count: 3 },
    { protocol_version: 1 },
    { reason: ' ' },
    { reason: '😀'.repeat(501) },
    { expected_head_sequence: 9007199254740993 },
    { expected_head_sequence: '01' },
    { expected_head_sequence: '9223372036854775808' },
  ])('rejects unbound/unsupported rollback input %j', patch => {
    expect(
      parseDictionaryRollbackCommandV2({ ...command, ...patch }).success
    ).toBe(false)
  })
  it('requires a new event for a changed head and forbids fabricated no-change/conflict receipts', () => {
    expect(
      parseDictionaryRollbackReceiptV2(
        { ...receipt, applied_head_sequence: command.expected_head_sequence },
        command
      ).success
    ).toBe(false)
    expect(
      parseDictionaryRollbackReceiptV2(
        { ...receipt, outcome: 'no-change' },
        command
      ).success
    ).toBe(false)
    expect(
      parseDictionaryRollbackReceiptV2(
        {
          ...receipt,
          outcome: 'head-conflict',
          applied_revision_id: current,
          applied_head_sequence: command.expected_head_sequence,
        },
        command
      ).success
    ).toBe(false)
    expect(
      parseDictionaryRollbackReceiptV2(
        { ...receipt, outcome: 'head-conflict', applied_revision_id: current },
        command
      ).success
    ).toBe(true)
    expect(
      parseDictionaryRollbackReceiptV2(
        {
          ...receipt,
          outcome: 'entry-unavailable',
          applied_revision_id: null,
          applied_head_sequence: null,
        },
        command
      ).success
    ).toBe(true)
    expect(
      parseDictionaryRollbackReceiptV2(
        { ...receipt, outcome: 'entry-unavailable' },
        command
      ).success
    ).toBe(false)
    const same = { ...command, target_revision_id: current }
    expect(
      parseDictionaryRollbackReceiptV2(
        {
          ...same,
          outcome: 'no-change',
          applied_revision_id: current,
          applied_head_sequence: command.expected_head_sequence,
          idempotent: false,
        },
        same
      ).success
    ).toBe(true)
  })
  it('orders rollback and ABA history by sequence while allowing repeated revision IDs and decreasing revision numbers', () => {
    expect(parseDictionaryEntryHistoryV2(page, entry)).toMatchObject({
      success: true,
      data: page,
    })
    const first = {
      ...page,
      events: [page.events[0]],
      next_before: page.events[0].head_sequence,
    }
    expect(parseDictionaryEntryHistoryV2(first, entry, null, 1).success).toBe(
      true
    )
    const second = { ...page, events: page.events.slice(1), next_before: null }
    expect(
      parseDictionaryEntryHistoryV2(second, entry, first.next_before, 2).success
    ).toBe(true)
    expect(
      parseDictionaryEntryHistoryV2(
        { ...page, events: [], next_before: null },
        entry,
        '0'
      ).success
    ).toBe(true)
  })
  it('rejects stale bindings, duplicate/reordered events, leaked actor IDs, hidden cursor jumps and corrupt dates', () => {
    const variants = [
      { ...page, entry_id: old },
      { ...page, current_revision_id: current },
      { ...page, events: [page.events[1], page.events[0]] },
      { ...page, events: [page.events[0], page.events[0]] },
      { ...page, events: [{ ...page.events[0], actor_id: entry }] },
      { ...page, next_before: '2' },
      { ...page, events: [{ ...page.events[0], changed_at: 'invalid' }] },
      { ...page, events: [{ ...page.events[0], revision_no: 0 }] },
      { ...page, events: [] },
    ]
    for (const value of variants)
      expect(parseDictionaryEntryHistoryV2(value, entry).success).toBe(false)
    expect(
      parseDictionaryEntryHistoryV2(page, entry, page.events[0].head_sequence)
        .success
    ).toBe(false)
    expect(parseDictionaryEntryHistoryV2(page, entry, null, 2).success).toBe(
      false
    )
  })
  it('verifies the complete field diff including nested data, media and explicit null', () => {
    expect(
      parseDictionaryRevisionDiffV2(diff, entry, old, current)
    ).toMatchObject({ success: true, data: diff })
    const same = {
      ...diff,
      to_revision_id: old,
      to_content: content,
      to_content_sha256: hash,
      changes: [],
    }
    expect(parseDictionaryRevisionDiffV2(same, entry, old, old).success).toBe(
      true
    )
    const reverse = {
      ...diff,
      from_revision_id: current,
      to_revision_id: old,
      from_content: nextContent,
      to_content: content,
      from_content_sha256: otherHash,
      to_content_sha256: hash,
      changes: diff.changes.map(c => ({
        ...c,
        before: c.after,
        after: c.before,
      })),
    }
    expect(
      parseDictionaryRevisionDiffV2(reverse, entry, current, old).success
    ).toBe(true)
  })
  it('rejects omitted/media/private diff fields, wrong values, unsupported JSON and unbound revisions', () => {
    const variants = [
      { ...diff, changes: diff.changes.slice(1) },
      { ...diff, changes: [...diff.changes].reverse() },
      {
        ...diff,
        changes: [{ ...diff.changes[0], before: 'private' }, diff.changes[1]],
      },
      {
        ...diff,
        changes: [{ field: 'repetition_count', before: 0, after: 3 }],
      },
      { ...diff, source_id: entry },
      { ...diff, to_revision_id: operation },
      { ...diff, to_content: { ...nextContent, private_original: 'private' } },
      {
        ...diff,
        changes: [{ ...diff.changes[0], before: undefined }, diff.changes[1]],
      },
      {
        ...diff,
        changes: [{ ...diff.changes[0], before: NaN }, diff.changes[1]],
      },
    ]
    for (const value of variants)
      expect(
        parseDictionaryRevisionDiffV2(value, entry, old, current).success
      ).toBe(false)
  })
  it('keeps audited actor/reason private to the separately bounded audit parser and permits Auth redaction', () => {
    const audit = {
      audit_id: operation,
      actor_id: entry,
      created_at: '2026-10-10T11:00:00Z',
      receipt,
    }
    expect(parseDictionaryRollbackAuditV2([audit], entry).success).toBe(true)
    expect(
      parseDictionaryRollbackAuditV2([{ ...audit, actor_id: null }], entry)
        .success
    ).toBe(true)
    expect(parseDictionaryRollbackAuditV2([audit, audit], entry).success).toBe(
      false
    )
    expect(
      parseDictionaryRollbackAuditV2(
        [{ ...audit, receipt: { ...receipt, idempotent: true } }],
        entry
      ).success
    ).toBe(false)
    expect(parseDictionaryRollbackAuditV2([audit], old).success).toBe(false)
    expect(parseDictionaryRollbackAuditV2([audit], entry, 0).success).toBe(
      false
    )
  })
})
