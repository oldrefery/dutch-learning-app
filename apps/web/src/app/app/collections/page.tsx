import { requireAuthContext } from '@/lib/auth/session'

export default async function CollectionsPage() {
  const auth = await requireAuthContext()

  return (
    <section>
      <p className="text-sm font-medium text-neutral-500">
        Authenticated workspace
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Collections
      </h1>
      <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-400">
        Authentication and access-level handling are active for{' '}
        {auth.email ?? 'this account'}. Collection data and management actions
        arrive in Phase 3.
      </p>
    </section>
  )
}
