import 'server-only'

import { isDictionaryFollowingEnabled } from '@/features/dictionary/repository'

export const REVIEW_SESSION_LIMIT = 100

export const isBoundedReviewEnabled = () =>
  process.env.WEB_BOUNDED_REVIEW_ENABLED === 'true' &&
  isDictionaryFollowingEnabled()
