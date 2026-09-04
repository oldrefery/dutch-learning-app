import { InsightsDashboard } from '@/features/insights/InsightsDashboard'
import { getInsightsData } from '@/features/insights/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function InsightsPage() {
  const auth = await requireAuthContext()
  const data = await getInsightsData(auth.userId)

  return (
    <section>
      <p className="dw-label">Learning analytics</p>
      <h1 className="dw-page-title mt-2">Insights</h1>
      <p className="dw-support mt-2 max-w-2xl">
        Understand your review workload, word difficulty, and long-term
        progress.
      </p>
      <div className="mt-8">
        <InsightsDashboard data={data} />
      </div>
    </section>
  )
}
