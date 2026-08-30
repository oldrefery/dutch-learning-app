import { PRODUCT_NAME } from '@woordenaar/domain'
import Link from 'next/link'
import { logout } from '@/app/(auth)/actions'
import type { AuthContext } from '@/lib/auth/session'

interface AuthenticatedShellProps {
  auth: AuthContext
  children: React.ReactNode
}

export function AuthenticatedShell({
  auth,
  children,
}: AuthenticatedShellProps) {
  const currentUserLabel =
    auth.email?.trim() || `User ${auth.userId.slice(0, 8)}`
  const accessLevelLabel =
    auth.accessLevel === 'full_access' ? 'Full access' : 'Read only'

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link className="font-semibold" href="/app/collections">
              {PRODUCT_NAME}
            </Link>
            <nav
              aria-label="Primary navigation"
              className="flex flex-wrap gap-x-4 gap-y-2"
            >
              <Link
                className="text-sm text-neutral-600 dark:text-neutral-300"
                href="/app/collections"
              >
                Collections
              </Link>
              <Link
                className="text-sm text-neutral-600 dark:text-neutral-300"
                href="/app/review"
              >
                Review
              </Link>
              <Link
                className="text-sm text-neutral-600 dark:text-neutral-300"
                href="/app/insights"
              >
                Insights
              </Link>
              <Link
                className="text-sm text-neutral-600 dark:text-neutral-300"
                href="/app/history"
              >
                History
              </Link>
            </nav>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div
              aria-label={`Current user: ${currentUserLabel}. ${accessLevelLabel}`}
              className="min-w-0 text-right"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Signed in as · {accessLevelLabel}
              </p>
              <p
                className="max-w-60 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100 sm:max-w-64"
                title={currentUserLabel}
              >
                {currentUserLabel}
              </p>
            </div>
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
