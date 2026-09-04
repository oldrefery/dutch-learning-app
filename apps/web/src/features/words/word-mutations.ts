import { addLocalCalendarDays, toLocalDateKey } from '@woordenaar/domain'

export interface ResetWordProgressUpdate {
  easiness_factor: number
  interval_days: number
  last_reviewed_at: null
  next_review_date: string
  repetition_count: number
}

export const buildResetWordProgressUpdate = (
  now: Date = new Date()
): ResetWordProgressUpdate => ({
  interval_days: 1,
  repetition_count: 0,
  easiness_factor: 2.5,
  next_review_date: toLocalDateKey(addLocalCalendarDays(now, 1)),
  last_reviewed_at: null,
})

export const hasDeleteConfirmation = (value: FormDataEntryValue | null) =>
  value === 'delete'
