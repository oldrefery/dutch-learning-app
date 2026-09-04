'use client'

import {
  BarChart3,
  Brain,
  Headphones,
  History,
  LibraryBig,
  ListPlus,
  LogOut,
  PackageOpen,
  Plus,
  Search,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import type { AccessLevel } from '@woordenaar/domain'
import { logout } from '@/app/(auth)/actions'
import styles from './AuthenticatedShell.module.css'

type NavigationIcon = typeof LibraryBig

interface NavigationItem {
  href: string
  icon: NavigationIcon
  label: string
  match: (pathname: string) => boolean
}

const PRIMARY_ITEMS: readonly NavigationItem[] = [
  {
    href: '/app/collections',
    icon: LibraryBig,
    label: 'Collections',
    match: pathname => pathname.startsWith('/app/collections'),
  },
  {
    href: '/app/review',
    icon: Brain,
    label: 'Review',
    match: pathname =>
      pathname === '/app/review' || pathname.startsWith('/app/review/'),
  },
  {
    href: '/app/add',
    icon: Plus,
    label: 'Add word',
    match: pathname =>
      pathname === '/app/add' || pathname.endsWith('/words/new'),
  },
  {
    href: '/app/history',
    icon: History,
    label: 'History',
    match: pathname => pathname.startsWith('/app/history'),
  },
  {
    href: '/app/settings',
    icon: Settings,
    label: 'Settings',
    match: pathname => pathname.startsWith('/app/settings'),
  },
]

const SECONDARY_ITEMS: readonly NavigationItem[] = [
  {
    href: '/app/insights',
    icon: BarChart3,
    label: 'Insights',
    match: pathname => pathname.startsWith('/app/insights'),
  },
  {
    href: '/app/batch-capture',
    icon: ListPlus,
    label: 'Batch capture',
    match: pathname => pathname.startsWith('/app/batch-capture'),
  },
  {
    href: '/app/starter-pack',
    icon: PackageOpen,
    label: 'Starter pack',
    match: pathname => pathname.startsWith('/app/starter-pack'),
  },
  {
    href: '/app/review/audio',
    icon: Headphones,
    label: 'Audio review',
    match: pathname => pathname.startsWith('/app/review/audio'),
  },
]

const getPageContext = (pathname: string) => {
  const activeItem = [...PRIMARY_ITEMS, ...SECONDARY_ITEMS].find(item =>
    item.match(pathname)
  )

  if (pathname.endsWith('/words/new')) {
    return { title: 'Add word', context: 'AI analysis · review before saving' }
  }

  if (pathname.includes('/words/')) {
    return { title: 'Word', context: 'Complete card · learning progress' }
  }

  return {
    title: activeItem?.label ?? 'De Woordenaar',
    context: activeItem
      ? 'Your Dutch learning workspace'
      : 'Focused vocabulary practice',
  }
}

const isItemVisible = (item: NavigationItem, accessLevel: AccessLevel) =>
  accessLevel === 'full_access' ||
  (item.label !== 'Add word' && item.label !== 'Batch capture')

const subscribeToConnectivity = (listener: () => void) => {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

const getConnectivitySnapshot = () => navigator.onLine
const getConnectivityServerSnapshot = () => true

function NavLink({
  dueCount,
  item,
  pathname,
}: {
  dueCount: number
  item: NavigationItem
  pathname: string
}) {
  const Icon = item.icon
  const isActive = item.match(pathname)

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
      href={item.href}
      title={item.label}
    >
      <Icon aria-hidden="true" className={styles.navIcon} size={19} />
      <span className={`${styles.navLabel} dw-app-sidebar-label`}>
        {item.label}
      </span>
      {item.label === 'Review' && dueCount > 0 && (
        <span className={styles.dueBadge}>
          {dueCount > 99 ? '99+' : dueCount}
        </span>
      )}
    </Link>
  )
}

export function AppNavigation({
  accessLevel,
  dueCount,
  userLabel,
}: {
  accessLevel: AccessLevel
  dueCount: number
  userLabel: string
}) {
  const pathname = usePathname()
  const isOnline = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getConnectivityServerSnapshot
  )
  const pageContext = getPageContext(pathname)
  const compactCollectionShell = /^\/app\/collections\/[^/]+(?:\/.*)?$/.test(
    pathname
  )
  const initials = userLabel.slice(0, 2).toUpperCase()
  const mobileItems = PRIMARY_ITEMS.filter(item =>
    isItemVisible(item, accessLevel)
  ).slice(0, 5)

  if (mobileItems.length < 5) {
    mobileItems.splice(2, 0, SECONDARY_ITEMS[0])
  }

  return (
    <>
      <aside
        className={`${styles.sidebar} dw-app-sidebar ${compactCollectionShell ? 'dw-compact-nav' : ''}`}
      >
        <Link className={styles.brand} href="/app/collections">
          <span className={styles.brandMark}>W</span>
          <span className={`${styles.brandName} dw-app-sidebar-label`}>
            De Woordenaar
          </span>
        </Link>

        <nav aria-label="Primary navigation" className={styles.navigation}>
          {PRIMARY_ITEMS.filter(item => isItemVisible(item, accessLevel)).map(
            item => (
              <NavLink
                dueCount={dueCount}
                item={item}
                key={item.label}
                pathname={pathname}
              />
            )
          )}
          <span className={styles.groupLabel}>More</span>
          {SECONDARY_ITEMS.filter(item => isItemVisible(item, accessLevel)).map(
            item => (
              <NavLink
                dueCount={dueCount}
                item={item}
                key={item.label}
                pathname={pathname}
              />
            )
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div
            aria-label={`Synchronization status: ${isOnline ? 'synced' : 'offline'}`}
            className={styles.syncLine}
          >
            <span
              aria-hidden="true"
              className={`${styles.syncDot} ${!isOnline ? styles.syncDotOffline : ''}`}
            />
            <span>
              {isOnline ? 'SYNCED · JUST NOW' : 'OFFLINE · CHANGES PAUSED'}
            </span>
          </div>
          <div className={styles.account}>
            <span aria-hidden="true" className={styles.avatar}>
              {initials}
            </span>
            <span className={styles.accountText}>
              <span className={styles.accountName}>{userLabel}</span>
              <span className={styles.accountMeta}>
                {accessLevel === 'full_access' ? 'Full access' : 'Read only'}
              </span>
            </span>
            <form action={logout}>
              <button
                aria-label="Sign out"
                className={styles.signOut}
                title="Sign out"
                type="submit"
              >
                <LogOut aria-hidden="true" size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className={`${styles.topbar} dw-app-topbar`}>
        <Link
          aria-label="Collections"
          className={styles.mobileBrand}
          href="/app/collections"
        >
          <span className={styles.brandMark}>W</span>
        </Link>
        <div className={styles.pageContext}>
          <span className={styles.pageName}>{pageContext.title}</span>
          <span className={styles.contextLine}>{pageContext.context}</span>
        </div>
        <div className={styles.topActions}>
          <label className={styles.search}>
            <Search aria-hidden="true" size={16} />
            <span className="dw-sr-only">Search your words</span>
            <input placeholder="Search your words" type="search" />
          </label>
          {accessLevel === 'full_access' && (
            <Link
              className={`dw-button dw-button--primary ${styles.topButton}`}
              href="/app/add"
            >
              <Plus aria-hidden="true" size={16} />
              Add word
            </Link>
          )}
          <span
            aria-label={`Signed in as ${userLabel}`}
            className={styles.mobileAvatar}
          >
            {initials}
          </span>
        </div>
      </header>

      <nav
        aria-label="Mobile navigation"
        className={`${styles.bottomNav} dw-app-bottom-nav`}
      >
        {mobileItems.map(item => {
          const Icon = item.icon
          const isActive = item.match(pathname)
          return (
            <Link
              aria-current={isActive ? 'page' : undefined}
              className={`${styles.bottomItem} ${isActive ? styles.bottomItemActive : ''}`}
              href={item.href}
              key={item.label}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{item.label}</span>
              {item.label === 'Review' && dueCount > 0 && (
                <span className={styles.dueBadge}>
                  {dueCount > 99 ? '99+' : dueCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
