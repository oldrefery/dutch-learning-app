import { listOwnedCollectionOptions } from '@/features/analysis/repository'
import { SettingsWorkspace } from '@/features/settings/SettingsWorkspace'
import { requireAuthContext } from '@/lib/auth/session'
import { getWebBuildInfo } from '@/lib/build-info'

export default async function SettingsPage() {
  const auth = await requireAuthContext()
  const collections = await listOwnedCollectionOptions(auth.userId)

  return (
    <section className="max-w-[760px]">
      <p className="dw-label">Account and application</p>
      <h1 className="dw-page-title mt-2">Settings</h1>
      <p className="dw-support mt-2 max-w-2xl">
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
