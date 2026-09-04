import { HistoryWorkspace } from '@/features/history/HistoryWorkspace'
import { requireAuthContext } from '@/lib/auth/session'

export default async function HistoryPage() {
  const auth = await requireAuthContext()
  return (
    <section>
      <p className="dw-label">Learning activity</p>
      <h1 className="dw-page-title mt-2">History</h1>
      <p className="dw-support mt-2 max-w-2xl">
        Revisit AI analyses from this browser, including words you did not save.
      </p>
      <div className="mt-8">
        <HistoryWorkspace userId={auth.userId} />
      </div>
    </section>
  )
}
