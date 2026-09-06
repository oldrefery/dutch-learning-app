import {
  isReviewCorrectionAcknowledgement,
  isReviewCorrectionInput,
} from './correction-validation'
import type { ReviewCorrectionInput } from './correction-contract'

const input: ReviewCorrectionInput = {
  userId: '00000000-0000-4000-8000-000000000001',
  wordId: '00000000-0000-4000-8000-000000000002',
  eventId: '00000000-0000-4000-8000-000000000003',
  correctionId: '00000000-0000-4000-8000-000000000004',
  expectedRevision: 0,
  assessment: 'hard',
}
const receipt = {
  correction_id: input.correctionId,
  event_id: input.eventId,
  word_id: input.wordId,
  accepted_revision: 1,
  effective_revision: 1,
  effective_assessment: 'hard',
  interval_days: 0,
  repetition_count: 0,
  easiness_factor: 1.3,
  next_review_date: '2028-02-29',
  last_reviewed_at: null,
}

test.each(['again', 'hard', 'good', 'easy'] as const)(
  'accepts %s with zero and the largest incrementable SQL revision',
  assessment => {
    for (const expectedRevision of [0, 2147483646]) {
      const command = { ...input, expectedRevision, assessment }
      expect(isReviewCorrectionInput(command)).toBe(true)
      expect(
        isReviewCorrectionAcknowledgement(
          {
            ...receipt,
            accepted_revision: expectedRevision + 1,
            effective_revision: expectedRevision + 1,
            effective_assessment: assessment,
          },
          command
        )
      ).toBe(true)
    }
  }
)

test.each(['userId', 'wordId', 'eventId', 'correctionId'])(
  'requires a UUID string for %s',
  field => {
    for (const value of [null, undefined, 12, {}, '', 'not-a-uuid']) {
      expect(isReviewCorrectionInput({ ...input, [field]: value })).toBe(false)
    }
  }
)

test.each([null, undefined, false, 1, 'input', [], {}])(
  'rejects a non-command input: %j',
  value => expect(isReviewCorrectionInput(value)).toBe(false)
)

test.each([-1, 0.5, NaN, Infinity, '0', null, 2147483647])(
  'rejects an invalid expected revision: %s',
  expectedRevision => {
    expect(isReviewCorrectionInput({ ...input, expectedRevision })).toBe(false)
  }
)

test.each([null, undefined, false, 1, 'receipt', [], {}])(
  'rejects a non-receipt acknowledgement: %j',
  value => expect(isReviewCorrectionAcknowledgement(value, input)).toBe(false)
)

test.each(['correction_id', 'event_id', 'word_id'])(
  'binds the receipt to the command %s',
  field => {
    expect(
      isReviewCorrectionAcknowledgement(
        { ...receipt, [field]: '00000000-0000-4000-8000-000000000099' },
        input
      )
    ).toBe(false)
  }
)

test.each(['interval_days', 'repetition_count', 'effective_revision'])(
  'rejects non-integer and unsafe %s values',
  field => {
    for (const value of [-1, 0.5, NaN, Infinity, 2 ** 53, '1', null]) {
      expect(
        isReviewCorrectionAcknowledgement({ ...receipt, [field]: value }, input)
      ).toBe(false)
    }
  }
)

test.each([1.3, 2.5])('accepts the SRS ease boundary %s', easiness_factor => {
  expect(
    isReviewCorrectionAcknowledgement({ ...receipt, easiness_factor }, input)
  ).toBe(true)
})

test.each([1.299, 2.501, NaN, Infinity, -Infinity, '2.5', null])(
  'rejects an invalid SRS ease: %s',
  easiness_factor => {
    expect(
      isReviewCorrectionAcknowledgement({ ...receipt, easiness_factor }, input)
    ).toBe(false)
  }
)

test.each([
  null,
  20260906,
  '2026-02-29',
  '2026-13-01',
  '2026-00-01',
  '2026-09-00',
  '2026-9-6',
  '2026-09-06T00:00:00Z',
  ' 2026-09-06',
  '2026-09-06 ',
])('rejects an invalid canonical calendar date: %j', next_review_date => {
  expect(
    isReviewCorrectionAcknowledgement({ ...receipt, next_review_date }, input)
  ).toBe(false)
})

test.each([null, '2026-09-06T12:00:00Z'])(
  'accepts reset or reviewed timestamps: %j',
  last_reviewed_at => {
    expect(
      isReviewCorrectionAcknowledgement({ ...receipt, last_reviewed_at }, input)
    ).toBe(true)
  }
)

test.each([undefined, 0, '', 'invalid'])(
  'rejects an invalid review timestamp: %j',
  last_reviewed_at => {
    expect(
      isReviewCorrectionAcknowledgement({ ...receipt, last_reviewed_at }, input)
    ).toBe(false)
  }
)

test.each([null, 3, 'unknown'])(
  'rejects invalid ratings even in a newer effective revision: %j',
  effective_assessment => {
    expect(
      isReviewCorrectionAcknowledgement(
        { ...receipt, effective_revision: 2, effective_assessment },
        input
      )
    ).toBe(false)
  }
)
