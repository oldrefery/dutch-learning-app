import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { createReviewCalendar, REVIEW_TIME_ZONE_COOKIE } from './calendar'

/** One day snapshot for the entire server render, even across midnight. */
export const getReviewCalendar = cache(async () => {
  const cookieStore = await cookies()
  return createReviewCalendar(cookieStore.get(REVIEW_TIME_ZONE_COOKIE)?.value)
})
