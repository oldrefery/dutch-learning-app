import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthenticatedShell } from '@/components/app/AuthenticatedShell'
import { AppNavigation } from '@/components/app/AppNavigation'
import { ReviewDueCountNavigation } from '@/components/app/ReviewDueCountNavigation'
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
  const userLabel = auth.email?.trim() || `User ${auth.userId.slice(0, 8)}`
  const navigation = (
    <Suspense
      fallback={
        <AppNavigation
          accessLevel={auth.accessLevel}
          dueCount={0}
          userLabel={userLabel}
        />
      }
    >
      <ReviewDueCountNavigation auth={auth} />
    </Suspense>
  )

  return (
    <AuthenticatedShell auth={auth} navigation={navigation}>
      {children}
    </AuthenticatedShell>
  )
}
