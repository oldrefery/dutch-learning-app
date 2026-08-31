import type { Metadata } from 'next'
import { AuthenticatedShell } from '@/components/app/AuthenticatedShell'
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
  return <AuthenticatedShell auth={auth}>{children}</AuthenticatedShell>
}
