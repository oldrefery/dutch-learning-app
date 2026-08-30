import { HistoryWorkspace } from '@/features/history/HistoryWorkspace'
import { listRecentReviewEvents } from '@/features/history/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function HistoryPage() {
  const auth = await requireAuthContext()
  const reviewEvents = await listRecentReviewEvents(auth.userId)

  return (
    <section>
      <p className="text-sm font-medium text-neutral-500">Learning activity</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">History</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        Revisit recent AI analyses and see how each review changed your learning
        schedule.
      </p>
      <div className="mt-8">
        <HistoryWorkspace reviewEvents={reviewEvents} userId={auth.userId} />
      </div>
    </section>
  )
}
