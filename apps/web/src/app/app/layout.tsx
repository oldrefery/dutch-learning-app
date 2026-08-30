import { PRODUCT_NAME } from '@woordenaar/domain'
import Link from 'next/link'
import { logout } from '@/app/(auth)/actions'
import { requireAuthContext } from '@/lib/auth/session'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requireAuthContext()

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link className="font-semibold" href="/app/collections">
              {PRODUCT_NAME}
            </Link>
            <nav aria-label="Primary navigation">
              <Link
                className="text-sm text-neutral-600 dark:text-neutral-300"
                href="/app/collections"
              >
                Collections
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {auth.accessLevel === 'full_access' ? 'Full access' : 'Read only'}
            </span>
            <form action={logout}>
              <button
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
