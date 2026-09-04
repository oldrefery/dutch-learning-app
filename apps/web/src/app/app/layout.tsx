import type { Metadata } from 'next'
import { AuthenticatedShell } from '@/components/app/AuthenticatedShell'
import { listCollectionOverviews } from '@/features/collections/repository'
import { requireAuthContext } from '@/lib/auth/session'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requireAuthContext()
  const collections = await listCollectionOverviews(auth.userId)
  const dueCount = collections.reduce(
    (total, collection) => total + collection.dueWords,
    0
  )

  return (
    <AuthenticatedShell auth={auth} dueCount={dueCount}>
      {children}
    </AuthenticatedShell>
  )
}
