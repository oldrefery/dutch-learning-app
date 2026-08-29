import { REVIEW_MODE } from '@/constants/ReviewConstants'
import type { ReviewEvent } from '@/types/ReviewTypes'
import {
  getAdaptiveReviewModeExplanation,
  resolveAdaptiveReviewMode,
} from '../reviewModePolicy'

type ReviewModeEvidence = Pick<
  ReviewEvent,
  | 'event_id'
  | 'assessment'
  | 'review_mode'
  | 'answered_correctly'
  | 'reviewed_at'
  | 'response_time_ms'
>

const event = (
  index: number,
  overrides: Partial<ReviewModeEvidence> = {}
): ReviewModeEvidence => ({
  event_id: `event-${String(index).padStart(2, '0')}`,
  assessment: 'good',
  review_mode: REVIEW_MODE.RECOGNITION,
  answered_correctly: true,
  reviewed_at: `2026-08-${String(index).padStart(2, '0')}T10:00:00.000Z`,
  response_time_ms: 1000,
  ...overrides,
})

describe('resolveAdaptiveReviewMode', () => {
  it('defaults new words and partial non-recognition history to Recognition', () => {
    expect(resolveAdaptiveReviewMode([])).toEqual({
      mode: REVIEW_MODE.RECOGNITION,
      reason: 'default',
      previousMode: null,
    })
    expect(
      resolveAdaptiveReviewMode([
        event(1, {
          review_mode: REVIEW_MODE.MEANING_RECALL,
          answered_correctly: null,
        }),
      ]).mode
    ).toBe(REVIEW_MODE.RECOGNITION)
  })

  it('promotes Recognition only after three successful Recognition reviews', () => {
    expect(resolveAdaptiveReviewMode([event(1), event(2)]).mode).toBe(
      REVIEW_MODE.RECOGNITION
    )
    expect(resolveAdaptiveReviewMode([event(1), event(2), event(3)])).toEqual({
      mode: REVIEW_MODE.MEANING_RECALL,
      reason: 'promotion',
      previousMode: REVIEW_MODE.RECOGNITION,
    })
  })

  it('does not treat an incorrect Recognition answer as a success', () => {
    expect(
      resolveAdaptiveReviewMode([
        event(1),
        event(2, { answered_correctly: false }),
        event(3),
      ]).mode
    ).toBe(REVIEW_MODE.RECOGNITION)
  })

  it('promotes Meaning Recall to Dutch Production after its own success window', () => {
    const history = [
      event(1),
      event(2),
      event(3),
      event(4, {
        review_mode: REVIEW_MODE.MEANING_RECALL,
        answered_correctly: null,
      }),
      event(5, {
        review_mode: REVIEW_MODE.MEANING_RECALL,
        answered_correctly: null,
      }),
      event(6, {
        review_mode: REVIEW_MODE.MEANING_RECALL,
        answered_correctly: null,
      }),
    ]

    expect(resolveAdaptiveReviewMode(history)).toEqual({
      mode: REVIEW_MODE.DUTCH_PRODUCTION,
      reason: 'promotion',
      previousMode: REVIEW_MODE.MEANING_RECALL,
    })
  })

  it('demotes one mode after two Again ratings in the last three matching reviews', () => {
    const promotedHistory = [
      event(1),
      event(2),
      event(3),
      event(4, {
        review_mode: REVIEW_MODE.MEANING_RECALL,
        assessment: 'again',
        answered_correctly: null,
      }),
      event(5, {
        review_mode: REVIEW_MODE.MEANING_RECALL,
        assessment: 'hard',
        answered_correctly: null,
      }),
    ]

    expect(resolveAdaptiveReviewMode(promotedHistory).mode).toBe(
      REVIEW_MODE.MEANING_RECALL
    )
    expect(
      resolveAdaptiveReviewMode([
        ...promotedHistory,
        event(6, {
          review_mode: REVIEW_MODE.MEANING_RECALL,
          assessment: 'again',
          answered_correctly: null,
        }),
      ])
    ).toEqual({
      mode: REVIEW_MODE.RECOGNITION,
      reason: 'demotion',
      previousMode: REVIEW_MODE.MEANING_RECALL,
    })
  })

  it('demotes Dutch Production to Meaning Recall at the same boundary', () => {
    const history = [
      event(1),
      event(2),
      event(3),
      ...[4, 5, 6].map(index =>
        event(index, {
          review_mode: REVIEW_MODE.MEANING_RECALL,
          answered_correctly: null,
        })
      ),
      event(7, {
        review_mode: REVIEW_MODE.DUTCH_PRODUCTION,
        assessment: 'again',
        answered_correctly: null,
      }),
      event(8, {
        review_mode: REVIEW_MODE.DUTCH_PRODUCTION,
        assessment: 'hard',
        answered_correctly: null,
      }),
    ]

    expect(resolveAdaptiveReviewMode(history).mode).toBe(
      REVIEW_MODE.DUTCH_PRODUCTION
    )
    expect(
      resolveAdaptiveReviewMode([
        ...history,
        event(9, {
          review_mode: REVIEW_MODE.DUTCH_PRODUCTION,
          assessment: 'again',
          answered_correctly: null,
        }),
      ])
    ).toEqual({
      mode: REVIEW_MODE.MEANING_RECALL,
      reason: 'demotion',
      previousMode: REVIEW_MODE.DUTCH_PRODUCTION,
    })
  })

  it('ignores events from modes outside the current policy state', () => {
    expect(
      resolveAdaptiveReviewMode([
        event(1),
        event(2, {
          review_mode: REVIEW_MODE.MEANING_RECALL,
          answered_correctly: null,
        }),
        event(3),
        event(4, {
          review_mode: REVIEW_MODE.DUTCH_PRODUCTION,
          assessment: 'again',
          answered_correctly: null,
        }),
      ]).mode
    ).toBe(REVIEW_MODE.RECOGNITION)
  })

  it('sorts evidence deterministically and ignores response time', () => {
    const slow = event(1, { response_time_ms: 60_000 })
    const fast = event(2, { response_time_ms: 1 })
    const missing = event(3, { response_time_ms: null })

    expect(resolveAdaptiveReviewMode([missing, slow, fast]).mode).toBe(
      REVIEW_MODE.MEANING_RECALL
    )
  })

  it('explains the latest transition', () => {
    expect(
      getAdaptiveReviewModeExplanation(
        resolveAdaptiveReviewMode([event(1), event(2), event(3)])
      )
    ).toContain('advanced from Recognition to Meaning Recall')
  })
})
