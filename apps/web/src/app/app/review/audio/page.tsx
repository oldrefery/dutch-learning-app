import { isBoundedReviewEnabled } from '@/features/review/bounded-review-config'
import { AudioReviewWorkspace } from '@/features/review/AudioReviewWorkspace'
import { getReviewWorkspaceData } from '@/features/review/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function AudioReviewPage() {
  const auth = await requireAuthContext()
  const bounded = isBoundedReviewEnabled()
  const data = bounded
    ? { collections: [], words: [], events: [] }
    : await getReviewWorkspaceData(auth.userId)

  return (
    <AudioReviewWorkspace
      bounded={bounded}
      data={data}
      key={auth.userId}
      userId={auth.userId}
    />
  )
}
