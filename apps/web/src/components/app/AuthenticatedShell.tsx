import type { AuthContext } from '@/lib/auth/session'
import { AppNavigation } from './AppNavigation'
import styles from './AuthenticatedShell.module.css'

interface AuthenticatedShellProps {
  auth: AuthContext
  children: React.ReactNode
  dueCount?: number
}

export function AuthenticatedShell({
  auth,
  children,
  dueCount = 0,
}: AuthenticatedShellProps) {
  const currentUserLabel =
    auth.email?.trim() || `User ${auth.userId.slice(0, 8)}`

  return (
    <div className={`${styles.shell} dw-app-shell`}>
      <AppNavigation
        accessLevel={auth.accessLevel}
        dueCount={dueCount}
        userLabel={currentUserLabel}
      />
      <div className={`${styles.workspace} dw-app-workspace`}>
        <main className={`${styles.main} dw-app-main`}>{children}</main>
      </div>
    </div>
  )
}
