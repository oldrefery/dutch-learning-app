import { ReviewWorkspace } from '@/features/review/ReviewWorkspace'
import { getReviewWorkspaceData } from '@/features/review/repository'
import type { ReviewScope } from '@/features/review/types'
import { requireAuthContext } from '@/lib/auth/session'

const getQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

const getInitialScope = (value: string | undefined): ReviewScope => {
  if (value === 'collection-due' || value === 'difficult-due') return value
  return 'all-due'
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const auth = await requireAuthContext()
  const query = await searchParams
  const data = await getReviewWorkspaceData(auth.userId)
  const requestedCollectionId = getQueryValue(query.collectionId) ?? null
  const initialCollectionId = data.collections.some(
    collection => collection.id === requestedCollectionId
  )
    ? requestedCollectionId
    : null

  return (
    <ReviewWorkspace
      data={data}
      initialCollectionId={initialCollectionId}
      initialScope={getInitialScope(getQueryValue(query.scope))}
      userId={auth.userId}
    />
  )
}
