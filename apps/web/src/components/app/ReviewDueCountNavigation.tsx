import type { AuthContext } from '@/lib/auth/session'
import { listCollectionOverviews } from '@/features/collections/repository'
import { AppNavigation } from './AppNavigation'

export async function ReviewDueCountNavigation({
  auth,
}: {
  auth: AuthContext
}) {
  const collections = await listCollectionOverviews(auth.userId)
  const dueCount = collections.reduce(
    (total, collection) => total + collection.dueWords,
    0
  )

  return (
    <AppNavigation
      accessLevel={auth.accessLevel}
      dueCount={dueCount}
      userLabel={auth.email?.trim() || `User ${auth.userId.slice(0, 8)}`}
    />
  )
}
