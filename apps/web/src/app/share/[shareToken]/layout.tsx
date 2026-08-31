import { AuthenticatedShell } from '@/components/app/AuthenticatedShell'
import { requireAuthContext } from '@/lib/auth/session'

export default async function SharedCollectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requireAuthContext()
  return <AuthenticatedShell auth={auth}>{children}</AuthenticatedShell>
}
