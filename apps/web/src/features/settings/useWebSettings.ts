'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  applyThemePreference,
  getWebSettingsServerSnapshot,
  getWebSettingsSnapshot,
  subscribeToWebSettings,
  updateWebSettings,
} from './settings-storage'
import type { WebSettings } from './settings-storage'

const subscribeToHydration = () => () => undefined
const getHydratedSnapshot = () => true
const getHydratedServerSnapshot = () => false

export function useWebSettings(userId: string) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getHydratedServerSnapshot
  )
  const subscribe = useCallback(
    (listener: () => void) => subscribeToWebSettings(userId, listener),
    [userId]
  )
  const getSnapshot = useCallback(
    () => getWebSettingsSnapshot(userId),
    [userId]
  )
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getWebSettingsServerSnapshot
  )

  useEffect(() => {
    applyThemePreference(settings.theme)
    if (settings.theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyThemePreference('system')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [settings.theme])

  const update = useCallback(
    (change: Partial<WebSettings>) => updateWebSettings(userId, change),
    [userId]
  )

  return { isHydrated, settings, update }
}
