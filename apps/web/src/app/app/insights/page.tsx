import { InsightsDashboard } from '@/features/insights/InsightsDashboard'
import { getInsightsData } from '@/features/insights/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function InsightsPage() {
  const auth = await requireAuthContext()
  const data = await getInsightsData(auth.userId)

  return (
    <section>
      <p className="text-sm font-medium text-neutral-500">Learning analytics</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Insights</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        Understand your review workload, word difficulty, and long-term
        progress.
      </p>
      <div className="mt-8">
        <InsightsDashboard data={data} />
      </div>
    </section>
  )
}
