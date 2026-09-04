'use client'

import Link from 'next/link'
import { useCallback, useSyncExternalStore } from 'react'
import { logout } from '@/app/(auth)/actions'
import type { AccessLevel } from '@woordenaar/domain'
import type { ReviewSessionMode } from '@/features/review/types'
import type { CollectionOption } from '@/features/words/repository'
import type { WebBuildInfo } from '@/lib/build-info'
import { DeleteAccountPanel } from './DeleteAccountPanel'
import type { ThemePreference } from './settings-storage'
import { useWebSettings } from './useWebSettings'

const MODE_OPTIONS: readonly {
  label: string
  value: ReviewSessionMode
}[] = [
  { value: 'adaptive', label: 'Adaptive' },
  { value: 'recognition', label: 'Recognition' },
  { value: 'meaning-recall', label: 'Meaning Recall' },
  { value: 'dutch-production', label: 'Dutch Production' },
]

const THEME_OPTIONS: readonly {
  description: string
  label: string
  value: ThemePreference
}[] = [
  { value: 'system', label: 'System', description: 'Follow this device.' },
  { value: 'light', label: 'Light', description: 'Always use light mode.' },
  { value: 'dark', label: 'Dark', description: 'Always use dark mode.' },
]

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

const Toggle = ({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  label: string
  onChange: (checked: boolean) => void
}) => (
  <label className="flex items-start justify-between gap-5 py-4">
    <span>
      <span className="block font-medium">{label}</span>
      <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </span>
    </span>
    <input
      checked={checked}
      className="mt-1 size-5 shrink-0 accent-neutral-900 dark:accent-neutral-100"
      onChange={event => onChange(event.target.checked)}
      role="switch"
      type="checkbox"
    />
  </label>
)

const DefinitionRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1 border-t border-neutral-200 py-3 first:border-t-0 dark:border-neutral-800 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <dt className="text-sm text-neutral-500">{label}</dt>
    <dd className="break-all text-sm font-medium sm:text-right">{value}</dd>
  </div>
)

export function SettingsWorkspace({
  accessLevel,
  buildInfo,
  collections,
  email,
  serverCheckedAt,
  userId,
}: {
  accessLevel: AccessLevel
  buildInfo: WebBuildInfo
  collections: CollectionOption[]
  email: string | null
  serverCheckedAt: string
  userId: string
}) {
  const { settings, update } = useWebSettings(userId)
  const isOnline = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getConnectivityServerSnapshot
  )
  const updateAdaptiveReview = useCallback(
    (enabled: boolean) => update({ adaptiveReviewEnabled: enabled }),
    [update]
  )

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Account</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Identity and access are shared with the mobile application through
              Supabase Auth.
            </p>
          </div>
          <span className="w-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold dark:bg-neutral-800">
            {accessLevel === 'full_access' ? 'Full access' : 'Read only'}
          </span>
        </div>
        <dl className="mt-5">
          <DefinitionRow label="Email" value={email ?? 'Unavailable'} />
          <DefinitionRow label="User ID" value={userId} />
        </dl>
        <form action={logout} className="mt-4">
          <button
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-700"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">Learning preferences</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Saved in this browser for the current user. Mobile preferences remain
          device-local.
        </p>
        <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
          <Toggle
            checked={settings.autoPlayPronunciation}
            description="Play the Dutch prompt when a review card appears. Browser media policy may require the session to be started first."
            label="Auto-play pronunciation"
            onChange={checked => update({ autoPlayPronunciation: checked })}
          />
          <Toggle
            checked={settings.adaptiveReviewEnabled}
            description="Allow review history to choose recognition, recall, or production separately for each word."
            label="Adaptive review modes"
            onChange={updateAdaptiveReview}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Default review mode
            <select
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
              onChange={event =>
                update({
                  lastSelectedReviewMode: event.target
                    .value as ReviewSessionMode,
                })
              }
              value={settings.lastSelectedReviewMode}
            >
              {MODE_OPTIONS.map(option => (
                <option
                  disabled={
                    option.value === 'adaptive' &&
                    !settings.adaptiveReviewEnabled
                  }
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Default collection
            <select
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
              onChange={event =>
                update({ lastSelectedCollectionId: event.target.value || null })
              }
              value={settings.lastSelectedCollectionId ?? ''}
            >
              <option value="">No default collection</option>
              {collections.map(collection => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <details className="mt-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <summary className="cursor-pointer font-medium outline-none focus-visible:ring-2 focus-visible:ring-neutral-500">
            Learning guide
          </summary>
          <div className="mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <p>
              Again repeats the word soon and resets successful repetitions.
            </p>
            <p>
              Hard, Good, and Easy progressively increase the review interval.
            </p>
            <p>
              Difficult words have an easiness factor of 2.10 or lower and can
              be reviewed separately from Insights.
            </p>
            <Link
              className="mt-2 font-semibold text-[var(--accent)]"
              href="/app/guide"
            >
              Open the complete learning guide
            </Link>
          </div>
        </details>
      </section>

      <fieldset className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <legend className="px-1 text-lg font-semibold">Appearance</legend>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          The selected theme applies immediately and is stored for this browser.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map(option => (
            <label
              className={`cursor-pointer rounded-xl border p-4 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-500 ${
                settings.theme === option.value
                  ? 'border-neutral-900 dark:border-neutral-100'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}
              key={option.value}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  checked={settings.theme === option.value}
                  name="theme"
                  onChange={() => update({ theme: option.value })}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </span>
              <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Connectivity and data</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Web writes go directly to Supabase. Offline queues and manual sync
              are reserved for the optional PWA phase.
            </p>
          </div>
          <span
            aria-live="polite"
            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              isOnline
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
            }`}
          >
            {isOnline ? 'Browser online' : 'Browser offline'}
          </span>
        </div>
        <dl className="mt-5">
          <DefinitionRow label="Storage" value="Supabase cloud database" />
          <DefinitionRow label="Offline queue" value="Not enabled" />
          <DefinitionRow
            label="Server data checked (UTC)"
            value={new Intl.DateTimeFormat('en', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'UTC',
            }).format(new Date(serverCheckedAt))}
          />
        </dl>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">Application</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Deployment and legal information for this web client.
        </p>
        <dl className="mt-5">
          <DefinitionRow label="Web version" value={buildInfo.version} />
          <DefinitionRow label="Environment" value={buildInfo.environment} />
          <DefinitionRow label="Framework" value={buildInfo.framework} />
          <DefinitionRow label="Host" value={buildInfo.host} />
          {buildInfo.branch && (
            <DefinitionRow label="Git branch" value={buildInfo.branch} />
          )}
          {buildInfo.commitSha && (
            <DefinitionRow label="Build commit" value={buildInfo.commitSha} />
          )}
        </dl>
        <nav aria-label="Legal documents" className="mt-5 flex flex-wrap gap-4">
          <a
            className="text-sm font-medium hover:underline"
            href="https://www.termsfeed.com/live/3e576e8c-54c9-4543-b808-890d7c98f662"
            rel="noreferrer"
            target="_blank"
          >
            Privacy Policy
          </a>
          <a
            className="text-sm font-medium hover:underline"
            href="https://www.termsfeed.com/live/855aec0d-a235-42e8-af6f-28166c93901a"
            rel="noreferrer"
            target="_blank"
          >
            Terms and Conditions
          </a>
          <a
            className="text-sm font-medium hover:underline"
            href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
            rel="noreferrer"
            target="_blank"
          >
            License Agreement
          </a>
        </nav>
      </section>

      <DeleteAccountPanel email={email} userId={userId} />
    </div>
  )
}
