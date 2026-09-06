import { getDatabase } from './initDB'

export interface LearningQueueHealth {
  count: number
  reviews: number
  resets: number
  oldestAgeSeconds: number | null
}

/** Read aggregate queue metadata only; never return identities or word data. */
export async function getLearningQueueHealth(
  userId: string,
  now = Date.now()
): Promise<LearningQueueHealth> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{
    count: number
    reviews: number
    resets: number
    oldest: number | null
  }>(
    `SELECT COUNT(*) AS count,
      COALESCE(SUM(c.kind = 'review'), 0) AS reviews,
      COALESCE(SUM(c.kind = 'reset'), 0) AS resets,
      MIN(CAST(strftime('%s', CASE WHEN c.kind = 'reset' THEN c.reset_at
        ELSE e.reviewed_at END) AS INTEGER)) AS oldest
     FROM learning_commands c LEFT JOIN review_events e
       ON c.kind = 'review' AND e.event_id = c.operation_id
       AND e.user_id = c.user_id AND e.word_id = c.word_id
     WHERE c.user_id = ?`,
    [userId]
  )
  return {
    count: row?.count ?? 0,
    reviews: row?.reviews ?? 0,
    resets: row?.resets ?? 0,
    oldestAgeSeconds:
      row?.oldest == null
        ? null
        : Math.max(0, Math.floor(now / 1000) - row.oldest),
  }
}
