import type { AuthContext } from '@/lib/auth/session'
import { AppNavigation } from './AppNavigation'
import { ReviewFreshnessProvider } from './ReviewFreshnessProvider'
import styles from './AuthenticatedShell.module.css'

interface AuthenticatedShellProps {
  auth: AuthContext
  children: React.ReactNode
  navigation?: React.ReactNode
  dueCount?: number
}

export function AuthenticatedShell({
  auth,
  children,
  navigation,
  dueCount = 0,
}: AuthenticatedShellProps) {
  const currentUserLabel =
    auth.email?.trim() || `User ${auth.userId.slice(0, 8)}`

  return (
    <ReviewFreshnessProvider key={auth.userId} userId={auth.userId}>
      <div className={`${styles.shell} dw-app-shell`}>
        {navigation ?? (
          <AppNavigation
            accessLevel={auth.accessLevel}
            dueCount={dueCount}
            userLabel={currentUserLabel}
          />
        )}
        <div className={`${styles.workspace} dw-app-workspace`}>
          <main className={`${styles.main} dw-app-main`}>{children}</main>
        </div>
      </div>
    </ReviewFreshnessProvider>
  )
}
