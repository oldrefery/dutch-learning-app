import {
  claimDictionaryCreationSubmission,
  parseDictionaryCreationCommandV2,
  parseDictionaryCreationResponseV2,
  parseDictionaryCreationSessionV2,
  parseDictionaryMeaningResolutionReceiptV2,
  parseDictionaryMeaningResolutionRequestV2,
  prepareDictionaryCreationCommand,
  reconcileDictionaryCreationResponse,
  recordDictionaryMeaningResolution,
  type DictionaryCreationReceiptV2,
  type DictionaryCreationSessionV2,
} from '@woordenaar/domain'

const OWNER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const RESOLUTION = '33333333-3333-4333-8333-333333333333'
const OPERATION = '44444444-4444-4444-8444-444444444444'
const ENTRY = '55555555-5555-4555-8555-555555555555'
const REVISION = '66666666-6666-4666-8666-666666666666'
const IDENTITY = '77777777-7777-4777-8777-777777777777'
const HASH = 'a'.repeat(64)
const REVIEW_REQUIRED = 'review-required'
const EXISTING_MEANING = 'existing-meaning'
const MEANING_UNCERTAIN = 'meaning-uncertain'
const ACTIVE_OWNER = 'active owner'
const SUBMITTED_COMMAND = 'submitted command'
const request = {
  protocol_version: 2 as const,
  resolution_id: RESOLUTION,
  original_query: '  BANK  ',
  meaning_hint: 'A financial institution, not a seat.',
}
const resolved = {
  ...request,
  outcome: 'new-meaning' as const,
  resolved_identity_id: IDENTITY,
  published: null,
  decision_code: null,
}
const command = {
  protocol_version: 2 as const,
  operation_id: OPERATION,
  resolution_id: RESOLUTION,
}
const published = {
  reference: { entry_id: ENTRY, revision_id: REVISION },
  content_sha256: HASH,
}
const initial = (): DictionaryCreationSessionV2 => ({
  user_id: OWNER,
  request,
  resolution: null,
  command: null,
  submitted: false,
  response: null,
})
const prepared = () =>
  prepareDictionaryCreationCommand(
    recordDictionaryMeaningResolution(initial(), resolved, OWNER),
    OPERATION,
    OWNER
  )
const submitted = () => claimDictionaryCreationSubmission(prepared(), OWNER)
const receipt = (
  overrides: Partial<DictionaryCreationReceiptV2> = {}
): DictionaryCreationReceiptV2 => ({
  ...command,
  entry_id: ENTRY,
  fence: '1',
  status: 'accepted',
  quota_charged: true,
  result_sha256: null,
  error_code: null,
  published: null,
  published_head_sequence: null,
  ...overrides,
})
const restart = (session: DictionaryCreationSessionV2) => {
  const parsed = parseDictionaryCreationSessionV2(
    JSON.parse(JSON.stringify(session))
  )
  if (!parsed.success) throw new Error(parsed.issues[0]?.message)
  return parsed.data
}

it('retains original user intent through JSON restart without deriving a meaning from spelling', () => {
  expect(restart(initial())).toEqual(initial())
  expect(parseDictionaryMeaningResolutionRequestV2(request)).toEqual({
    success: true,
    data: request,
  })
  expect(() =>
    prepareDictionaryCreationCommand(initial(), OPERATION, OWNER)
  ).toThrow('resolved new meaning')
})
it.each([
  'actor_id',
  'entry_id',
  'expected_revision_id',
  'expected_head_sequence',
  'anchor',
  'source_approved',
  'content',
  'verified_by',
])('rejects client-supplied authority or reanalysis field %s', field => {
  expect(
    parseDictionaryCreationCommandV2({ ...command, [field]: OWNER }).success
  ).toBe(false)
  expect(
    parseDictionaryMeaningResolutionRequestV2({ ...request, [field]: OWNER })
      .success
  ).toBe(false)
})
it.each(['', ' '.repeat(20), 'x'.repeat(121), 'bank\u0000'])(
  'rejects invalid normalized query %p',
  original_query => {
    expect(
      parseDictionaryMeaningResolutionRequestV2({ ...request, original_query })
        .success
    ).toBe(false)
  }
)
it('requires a bounded disambiguating hint and separate command nonce', () => {
  expect(
    parseDictionaryMeaningResolutionRequestV2({ ...request, meaning_hint: '' })
      .success
  ).toBe(false)
  expect(
    parseDictionaryMeaningResolutionRequestV2({
      ...request,
      meaning_hint: 'x'.repeat(1001),
    }).success
  ).toBe(false)
  expect(
    parseDictionaryCreationCommandV2({ ...command, operation_id: RESOLUTION })
      .success
  ).toBe(false)
  expect(
    parseDictionaryCreationCommandV2({ ...command, protocol_version: 1 })
      .success
  ).toBe(false)
})
it.each([REVIEW_REQUIRED, 'rejected', EXISTING_MEANING] as const)(
  'cannot prepare creation for %s resolution',
  outcome => {
    const resolution = {
      ...request,
      outcome,
      resolved_identity_id: null,
      published: outcome === EXISTING_MEANING ? published : null,
      decision_code:
        outcome === REVIEW_REQUIRED
          ? MEANING_UNCERTAIN
          : outcome === 'rejected'
            ? 'source-unapproved'
            : null,
    }
    const saved = recordDictionaryMeaningResolution(
      initial(),
      resolution,
      OWNER
    )
    expect(restart(saved).resolution).toEqual(resolution)
    expect(() =>
      prepareDictionaryCreationCommand(saved, OPERATION, OWNER)
    ).toThrow('resolved new meaning')
  }
)
it('rejects mixed resolution evidence and does not let a later result rewrite the original query or sense', () => {
  expect(
    parseDictionaryMeaningResolutionReceiptV2({ ...resolved, published })
      .success
  ).toBe(false)
  expect(
    parseDictionaryMeaningResolutionReceiptV2({
      ...resolved,
      resolved_identity_id: null,
    }).success
  ).toBe(false)
  expect(() =>
    recordDictionaryMeaningResolution(
      initial(),
      { ...resolved, meaning_hint: 'A seat.' },
      OWNER
    )
  ).toThrow('original owner request')
  const saved = recordDictionaryMeaningResolution(initial(), resolved, OWNER)
  expect(recordDictionaryMeaningResolution(saved, resolved, OWNER)).toEqual(
    saved
  )
  expect(() =>
    recordDictionaryMeaningResolution(
      saved,
      { ...resolved, resolved_identity_id: OTHER },
      OWNER
    )
  ).toThrow('immutable')
})
it('never deduplicates two senses by normalized spelling', () => {
  const financial = recordDictionaryMeaningResolution(
    initial(),
    resolved,
    OWNER
  )
  const seatRequest = {
    ...request,
    resolution_id: OTHER,
    meaning_hint: 'A seat.',
  }
  const seat = recordDictionaryMeaningResolution(
    { ...initial(), request: seatRequest },
    { ...resolved, ...seatRequest, resolved_identity_id: ENTRY },
    OWNER
  )
  expect(financial.request.original_query).toBe(seat.request.original_query)
  expect(financial.resolution?.resolved_identity_id).not.toBe(
    seat.resolution?.resolved_identity_id
  )
})
it('binds reservation/reconciliation to the active owner after restart', () => {
  expect(() =>
    recordDictionaryMeaningResolution(initial(), resolved, OTHER)
  ).toThrow(ACTIVE_OWNER)
  expect(() =>
    prepareDictionaryCreationCommand(
      recordDictionaryMeaningResolution(initial(), resolved, OWNER),
      OPERATION,
      OTHER
    )
  ).toThrow(ACTIVE_OWNER)
  expect(() =>
    claimDictionaryCreationSubmission(restart(prepared()), OTHER)
  ).toThrow(ACTIVE_OWNER)
  expect(() =>
    reconcileDictionaryCreationResponse(restart(submitted()), receipt(), OTHER)
  ).toThrow(ACTIVE_OWNER)
})
it('saves the submission reservation and refuses a second dispatch after a lost response', () => {
  const saved = restart(submitted())
  expect(saved.request).toEqual(request)
  expect(saved.response).toBeNull()
  expect(() => claimDictionaryCreationSubmission(saved, OWNER)).toThrow(
    'reconcile status'
  )
  expect(
    reconcileDictionaryCreationResponse(saved, receipt(), OWNER).response
  ).toEqual(receipt())
})
it('rejects response before reservation, changed operation, changed resolution and journal injection', () => {
  expect(() =>
    reconcileDictionaryCreationResponse(prepared(), receipt(), OWNER)
  ).toThrow(SUBMITTED_COMMAND)
  expect(() =>
    reconcileDictionaryCreationResponse(
      submitted(),
      receipt({ operation_id: OTHER }),
      OWNER
    )
  ).toThrow(SUBMITTED_COMMAND)
  expect(() =>
    reconcileDictionaryCreationResponse(
      submitted(),
      receipt({ resolution_id: OTHER }),
      OWNER
    )
  ).toThrow(SUBMITTED_COMMAND)
  expect(
    parseDictionaryCreationSessionV2({ ...submitted(), private_analysis: {} })
      .success
  ).toBe(false)
})
it.each([
  { fence: '0' },
  { fence: '01' },
  { fence: '9223372036854775808' },
  { quota_charged: false },
  { status: 'no-change' },
  { status: 'validating' },
  { status: REVIEW_REQUIRED, error_code: MEANING_UNCERTAIN },
  { status: 'dispatching', result_sha256: HASH },
  { published },
  { error_code: 'unexpected' },
  { status: 'provider-failed', error_code: null },
  { result_sha256: 'A'.repeat(64) },
])('rejects malformed or inconsistent receipt %p', overrides => {
  expect(
    parseDictionaryCreationResponseV2({ ...receipt(), ...overrides }).success
  ).toBe(false)
})
it.each([
  { published_head_sequence: '0' },
  { published_head_sequence: '01' },
  { result_sha256: null },
  { published: null },
  {
    published: {
      ...published,
      reference: { ...published.reference, entry_id: OTHER },
    },
  },
])('requires an exact validated first publication %p', overrides => {
  expect(
    parseDictionaryCreationResponseV2({
      ...receipt({
        status: 'published',
        published,
        published_head_sequence: '1',
        result_sha256: HASH,
      }),
      ...overrides,
    }).success
  ).toBe(false)
})
it('allows skipped observations through publication and preserves the adoption reference immutably', () => {
  const accepted = reconcileDictionaryCreationResponse(
    submitted(),
    receipt(),
    OWNER
  )
  const result = receipt({
    status: 'published',
    published,
    published_head_sequence: '1',
    result_sha256: HASH,
  })
  const done = restart(
    reconcileDictionaryCreationResponse(accepted, result, OWNER)
  )
  expect(done.response).toEqual(result)
  expect(reconcileDictionaryCreationResponse(done, result, OWNER)).toEqual(done)
  expect(() =>
    reconcileDictionaryCreationResponse(done, receipt(), OWNER)
  ).toThrow('immutable')
  expect(() =>
    reconcileDictionaryCreationResponse(
      done,
      {
        ...result,
        published: { ...published, content_sha256: 'b'.repeat(64) },
      },
      OWNER
    )
  ).toThrow('terminal receipt')
})
it('quarantines unknown provider outcomes; status reconciliation cannot restart dispatch or replace the fence', () => {
  const unknown = receipt({
    status: 'provider-outcome-unknown',
    error_code: 'provider-outcome-unknown',
  })
  const saved = restart(
    reconcileDictionaryCreationResponse(submitted(), unknown, OWNER)
  )
  expect(() => claimDictionaryCreationSubmission(saved, OWNER)).toThrow(
    'reconcile status'
  )
  expect(() =>
    reconcileDictionaryCreationResponse(
      saved,
      receipt({ status: 'dispatching' }),
      OWNER
    )
  ).toThrow('must not regress')
  const validated = receipt({ status: 'validating', result_sha256: HASH })
  expect(() =>
    reconcileDictionaryCreationResponse(
      saved,
      { ...validated, fence: '2' },
      OWNER
    )
  ).toThrow('immutable')
  const recovered = reconcileDictionaryCreationResponse(saved, validated, OWNER)
  expect(() =>
    reconcileDictionaryCreationResponse(
      recovered,
      {
        ...validated,
        status: 'published',
        published,
        published_head_sequence: '1',
        result_sha256: 'b'.repeat(64),
      },
      OWNER
    )
  ).toThrow('immutable')
  expect(() =>
    reconcileDictionaryCreationResponse(
      recovered,
      receipt({ status: 'dispatching' }),
      OWNER
    )
  ).toThrow()
})
it('keeps review-required results terminal, unpublished and charged', () => {
  const result = receipt({
    status: REVIEW_REQUIRED,
    result_sha256: HASH,
    error_code: MEANING_UNCERTAIN,
  })
  const saved = restart(
    reconcileDictionaryCreationResponse(submitted(), result, OWNER)
  )
  expect(saved.response).toEqual(result)
  expect(() =>
    reconcileDictionaryCreationResponse(
      saved,
      receipt({
        status: 'published',
        published,
        published_head_sequence: '1',
        result_sha256: HASH,
      }),
      OWNER
    )
  ).toThrow('terminal receipt')
})
it('distinguishes zero-charge existing meaning from busy; neither creates a personal word or accepts quota', () => {
  const existing = {
    ...command,
    outcome: EXISTING_MEANING,
    quota_charged: false,
    published,
  }
  const saved = restart(
    reconcileDictionaryCreationResponse(submitted(), existing, OWNER)
  )
  expect(saved.response).toEqual(existing)
  expect(() =>
    reconcileDictionaryCreationResponse(saved, receipt(), OWNER)
  ).toThrow('terminal publication')
  const busy = {
    ...command,
    outcome: 'creation-in-progress',
    quota_charged: false,
  }
  expect(
    restart(reconcileDictionaryCreationResponse(submitted(), busy, OWNER))
      .response
  ).toEqual(busy)
  expect(
    parseDictionaryCreationResponseV2({ ...busy, quota_charged: true }).success
  ).toBe(false)
  expect(
    parseDictionaryCreationResponseV2({ ...existing, actor_id: OWNER }).success
  ).toBe(false)
  expect(() =>
    reconcileDictionaryCreationResponse(
      reconcileDictionaryCreationResponse(submitted(), receipt(), OWNER),
      existing,
      OWNER
    )
  ).toThrow('immutable')
})

it('rejects empty response recordings, foreign resolution references and a second command reservation', () => {
  expect(() =>
    recordDictionaryMeaningResolution(initial(), null, OWNER)
  ).toThrow()
  expect(() =>
    reconcileDictionaryCreationResponse(submitted(), null, OWNER)
  ).toThrow()
  expect(() =>
    recordDictionaryMeaningResolution(
      initial(),
      { ...resolved, resolution_id: OTHER },
      OWNER
    )
  ).toThrow('original owner request')
  expect(() =>
    prepareDictionaryCreationCommand(prepared(), OTHER, OWNER)
  ).toThrow('already reserved')
})

it('retains a positive global publication cursor independently of first revision number', () => {
  const result = receipt({
    status: 'published',
    published,
    published_head_sequence: '9007199254740993',
    result_sha256: HASH,
  })
  const parsed = parseDictionaryCreationResponseV2(result)
  expect(parsed).toEqual({ success: true, data: result })
  expect(
    restart(reconcileDictionaryCreationResponse(submitted(), result, OWNER))
      .response
  ).toEqual(result)
  expect(
    parseDictionaryCreationResponseV2({
      ...result,
      published_head_sequence: '9223372036854775808',
    }).success
  ).toBe(false)
})

it('keeps a zero-charge busy response immutable for its command nonce', () => {
  const busy = {
    ...command,
    outcome: 'creation-in-progress',
    quota_charged: false,
  }
  const saved = reconcileDictionaryCreationResponse(submitted(), busy, OWNER)
  expect(() =>
    reconcileDictionaryCreationResponse(saved, receipt(), OWNER)
  ).toThrow('immutable')
  expect(
    reconcileDictionaryCreationResponse(restart(saved), busy, OWNER)
  ).toEqual(saved)
})
