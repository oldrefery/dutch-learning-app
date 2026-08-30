import type { ReviewSessionMode } from '@/features/review/types'

const SETTINGS_STORAGE_PREFIX = 'woordenaar:web:settings'
export const THEME_STORAGE_KEY = 'woordenaar:web:theme'

export type ThemePreference = 'system' | 'light' | 'dark'

export interface WebSettings {
  adaptiveReviewEnabled: boolean
  autoPlayPronunciation: boolean
  lastSelectedCollectionId: string | null
  lastSelectedReviewMode: ReviewSessionMode
  theme: ThemePreference
}

export const DEFAULT_WEB_SETTINGS: Readonly<WebSettings> = {
  adaptiveReviewEnabled: true,
  autoPlayPronunciation: false,
  lastSelectedCollectionId: null,
  lastSelectedReviewMode: 'adaptive',
  theme: 'system',
}

const REVIEW_MODES = new Set<ReviewSessionMode>([
  'adaptive',
  'recognition',
  'meaning-recall',
  'dutch-production',
])
const THEMES = new Set<ThemePreference>(['system', 'light', 'dark'])
const snapshots = new Map<string, Readonly<WebSettings>>()
const listeners = new Map<string, Set<() => void>>()

const getStorageKey = (userId: string) => `${SETTINGS_STORAGE_PREFIX}:${userId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isReviewMode = (value: unknown): value is ReviewSessionMode =>
  typeof value === 'string' && REVIEW_MODES.has(value as ReviewSessionMode)

const isTheme = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && THEMES.has(value as ThemePreference)

export const normalizeWebSettings = (value: unknown): WebSettings => {
  const settings = isRecord(value) ? value : {}
  const adaptiveReviewEnabled =
    typeof settings.adaptiveReviewEnabled === 'boolean'
      ? settings.adaptiveReviewEnabled
      : DEFAULT_WEB_SETTINGS.adaptiveReviewEnabled
  const selectedMode = isReviewMode(settings.lastSelectedReviewMode)
    ? settings.lastSelectedReviewMode
    : DEFAULT_WEB_SETTINGS.lastSelectedReviewMode

  return {
    adaptiveReviewEnabled,
    autoPlayPronunciation:
      typeof settings.autoPlayPronunciation === 'boolean'
        ? settings.autoPlayPronunciation
        : DEFAULT_WEB_SETTINGS.autoPlayPronunciation,
    lastSelectedCollectionId:
      typeof settings.lastSelectedCollectionId === 'string' ||
      settings.lastSelectedCollectionId === null
        ? settings.lastSelectedCollectionId
        : DEFAULT_WEB_SETTINGS.lastSelectedCollectionId,
    lastSelectedReviewMode:
      !adaptiveReviewEnabled && selectedMode === 'adaptive'
        ? 'meaning-recall'
        : selectedMode,
    theme: isTheme(settings.theme)
      ? settings.theme
      : DEFAULT_WEB_SETTINGS.theme,
  }
}

export const parseWebSettings = (serialized: string | null): WebSettings => {
  if (!serialized) return { ...DEFAULT_WEB_SETTINGS }

  try {
    return normalizeWebSettings(JSON.parse(serialized) as unknown)
  } catch {
    return { ...DEFAULT_WEB_SETTINGS }
  }
}

const readSettings = (userId: string): Readonly<WebSettings> => {
  const cached = snapshots.get(userId)
  if (cached) return cached
  if (typeof window === 'undefined') return DEFAULT_WEB_SETTINGS

  try {
    const settings = parseWebSettings(
      window.localStorage.getItem(getStorageKey(userId))
    )
    snapshots.set(userId, settings)
    return settings
  } catch {
    return DEFAULT_WEB_SETTINGS
  }
}

const resolveTheme = (theme: ThemePreference): 'light' | 'dark' => {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export const applyThemePreference = (theme: ThemePreference): void => {
  if (typeof window === 'undefined') return
  document.documentElement.dataset.theme = resolveTheme(theme)
}

const emitChange = (userId: string) => {
  listeners.get(userId)?.forEach(listener => listener())
}

export const updateWebSettings = (
  userId: string,
  update: Partial<WebSettings>
): void => {
  if (typeof window === 'undefined') return

  const next = normalizeWebSettings({ ...readSettings(userId), ...update })
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(next))
    window.localStorage.setItem(THEME_STORAGE_KEY, next.theme)
  } catch {
    // Keep the settings usable in memory when browser storage is unavailable.
  }
  snapshots.set(userId, next)
  applyThemePreference(next.theme)
  emitChange(userId)
}

export const subscribeToWebSettings = (
  userId: string,
  listener: () => void
) => {
  const userListeners = listeners.get(userId) ?? new Set<() => void>()
  userListeners.add(listener)
  listeners.set(userId, userListeners)

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== getStorageKey(userId)) return
    snapshots.delete(userId)
    listener()
  }
  window.addEventListener('storage', handleStorage)

  return () => {
    userListeners.delete(listener)
    if (userListeners.size === 0) listeners.delete(userId)
    window.removeEventListener('storage', handleStorage)
  }
}

export const getWebSettingsSnapshot = (userId: string) => readSettings(userId)

export const getWebSettingsServerSnapshot = () => DEFAULT_WEB_SETTINGS

export const clearWebSettings = (userId: string): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(getStorageKey(userId))
  } catch {
    return
  }
  snapshots.delete(userId)
  emitChange(userId)
}
