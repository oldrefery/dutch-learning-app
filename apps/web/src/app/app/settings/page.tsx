import { listOwnedCollectionOptions } from '@/features/analysis/repository'
import { SettingsWorkspace } from '@/features/settings/SettingsWorkspace'
import { requireAuthContext } from '@/lib/auth/session'
import { getWebBuildInfo } from '@/lib/build-info'

export default async function SettingsPage() {
  const auth = await requireAuthContext()
  const collections = await listOwnedCollectionOptions(auth.userId)

  return (
    <section>
      <p className="text-sm font-medium text-neutral-500">
        Account and application
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        Manage browser preferences, inspect connectivity, and control your
        account.
      </p>
      <div className="mt-8">
        <SettingsWorkspace
          accessLevel={auth.accessLevel}
          buildInfo={getWebBuildInfo()}
          collections={collections}
          email={auth.email}
          serverCheckedAt={new Date().toISOString()}
          userId={auth.userId}
        />
      </div>
    </section>
  )
}
