import React, { useMemo } from 'react'
import { NativeTabs } from 'expo-router/native-tabs'
import { Redirect } from 'expo-router'
import { DynamicColorIOS, Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { useSessionGate } from '@/hooks/useSessionGate'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SessionUnavailableScreen } from '@/components/SessionUnavailableScreen'
import { ROUTES } from '@/constants/Routes'
import { useReviewWordsCount } from '@/hooks/useReviewWordsCount'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSyncManager } from '@/hooks/useSyncManager'

const lightFeedback = {
  tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
}
const mediumFeedback = {
  tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
}

export default function TabLayout() {
  const colorScheme = useNormalizedColorScheme()
  const session = useSessionGate()

  // Get review words count for badge
  const { reviewWordsCount } = useReviewWordsCount()

  // Get user access level
  const userAccessLevel = useApplicationStore(state => state.userAccessLevel)

  const shouldAutoSync = session.status === 'signed-in'
  const syncOptions = useMemo(
    () => ({
      autoSyncOnMount: shouldAutoSync,
      autoSyncOnFocus: shouldAutoSync,
      autoSyncOnNetworkChange: shouldAutoSync,
    }),
    [shouldAutoSync]
  )

  // Initialize offline-first sync (only when authenticated)
  useSyncManager(syncOptions)

  const labelColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: Colors.light.text, dark: Colors.dark.text })
      : Colors[colorScheme].text
  const tintColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: Colors.light.tint, dark: Colors.dark.tint })
      : Colors[colorScheme].tint
  const badgeColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({
          light: Colors.error.DEFAULT,
          dark: Colors.error.darkMode,
        })
      : colorScheme === 'dark'
        ? Colors.error.darkMode
        : Colors.error.DEFAULT

  if (session.status === 'unavailable') {
    return <SessionUnavailableScreen onRetry={session.retry} />
  }
  if (session.status === 'checking') {
    return <LoadingScreen />
  }

  if (session.status === 'signed-out') {
    return <Redirect href={ROUTES.AUTH.LOGIN} />
  }

  return (
    <NativeTabs
      labelStyle={{
        default: { color: labelColor },
        selected: { color: tintColor },
      }}
      tintColor={tintColor}
      badgeBackgroundColor={badgeColor}
      labelVisibilityMode="labeled"
    >
      {/* Primary navigation - left side (the most frequent use) */}
      <NativeTabs.Trigger
        name="index"
        testID="tab-collections"
        listeners={lightFeedback}
      >
        <NativeTabs.Trigger.Label>Collections</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      {/* Secondary navigation */}
      <NativeTabs.Trigger
        name="history"
        testID="tab-history"
        listeners={lightFeedback}
      >
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.fill" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="settings"
        testID="tab-settings"
        listeners={lightFeedback}
      >
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gear" md="settings" />
      </NativeTabs.Trigger>

      {/* Primary actions - right side for thumb accessibility */}
      <NativeTabs.Trigger
        name="review"
        testID="tab-review"
        listeners={mediumFeedback}
      >
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
        {/* Smart badge showing review words count */}
        {reviewWordsCount > 0 && (
          <NativeTabs.Trigger.Badge>
            {reviewWordsCount > 99 ? '99+' : reviewWordsCount.toString()}
          </NativeTabs.Trigger.Badge>
        )}
        <NativeTabs.Trigger.Icon sf="brain.head.profile" md="school" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="add-word"
        testID="tab-add-word"
        hidden={userAccessLevel !== 'full_access'}
        listeners={mediumFeedback}
      >
        <NativeTabs.Trigger.Label>Add Word</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus.circle.fill" md="add_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
