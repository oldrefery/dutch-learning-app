import {
  buildResetWordProgressUpdate,
  hasDeleteConfirmation,
} from './word-mutations'

describe('word mutations', () => {
  it('builds the mobile-compatible reset state for tomorrow', () => {
    expect(
      buildResetWordProgressUpdate(new Date('2026-08-30T15:00:00.000Z'))
    ).toEqual({
      interval_days: 1,
      repetition_count: 0,
      easiness_factor: 2.5,
      next_review_date: '2026-08-31',
      last_reviewed_at: null,
    })
  })

  it('uses the next local calendar date when reset happens after midnight', () => {
    expect(
      buildResetWordProgressUpdate(new Date(2026, 7, 30, 0, 30))
        .next_review_date
    ).toBe('2026-08-31')
  })

  it('requires the explicit delete checkbox value', () => {
    expect(hasDeleteConfirmation('delete')).toBe(true)
    expect(hasDeleteConfirmation('on')).toBe(false)
    expect(hasDeleteConfirmation(null)).toBe(false)
  })
})
