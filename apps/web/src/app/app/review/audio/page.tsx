import { AudioReviewWorkspace } from '@/features/review/AudioReviewWorkspace'
import { getReviewWorkspaceData } from '@/features/review/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function AudioReviewPage() {
  const auth = await requireAuthContext()
  const data = await getReviewWorkspaceData(auth.userId)

  return <AudioReviewWorkspace data={data} />
}
