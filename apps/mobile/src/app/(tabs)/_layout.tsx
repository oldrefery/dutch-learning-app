import React, { useEffect, useMemo, useState, ComponentProps } from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { router } from 'expo-router'
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Platform,
  PlatformColor,
  DynamicColorIOS,
  ViewStyle,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { Colors } from '@/constants/Colors'
import { useClientOnlyValue } from '@/components/useClientOnlyValue'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { supabase } from '@/lib/supabaseClient'
import { ROUTES } from '@/constants/Routes'
import { useReviewWordsCount } from '@/hooks/useReviewWordsCount'
import { Sentry } from '@/lib/sentry'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSyncManager } from '@/hooks/useSyncManager'

// Extended types for NativeTabs components with runtime-supported props
type TabTriggerProps = ComponentProps<typeof NativeTabs.Trigger> & {
  onPress?: () => void | Promise<void>
  testID?: string
}

type BadgeWithStyleProps = ComponentProps<typeof NativeTabs.Trigger.Badge> & {
  style?: ViewStyle | ViewStyle[]
}

type NativeTabsLabelStyle = {
  color?: string | ReturnType<typeof DynamicColorIOS>
  tintColor?: string | ReturnType<typeof DynamicColorIOS>
  fontSize?: number
  fontWeight?: string
}

const TabTrigger = NativeTabs.Trigger as React.ComponentType<TabTriggerProps>
const StyledBadge = NativeTabs.Trigger
  .Badge as React.ComponentType<BadgeWithStyleProps>

export default function TabLayout() {
  const colorScheme = useNormalizedColorScheme()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Get review words count for badge
  const { reviewWordsCount } = useReviewWordsCount()

  // Get user access level
  const userAccessLevel = useApplicationStore(state => state.userAccessLevel)

  const shouldAutoSync = isAuthenticated === true
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

  // Call this unconditionally to follow the rules of hooks (not used in Native Tabs)
  useClientOnlyValue(false, true)

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          Sentry.addBreadcrumb({
            category: 'auth',
            level: 'warning',
            message: '[TabLayout] Session check failed',
            data: { errorMessage: error.message },
          })
          setIsAuthenticated(prev => (prev === false ? prev : false))
          Sentry.captureException(error, {
            tags: { operation: 'tabLayoutSessionCheck' },
            extra: { message: '[TabLayout] Session check error' },
          })

          return
        }

        const authenticated = !!session?.user

        Sentry.addBreadcrumb({
          category: 'auth',
          level: 'info',
          message: '[TabLayout] Session check complete',
          data: { authenticated },
        })

        setIsAuthenticated(prev =>
          prev === authenticated ? prev : authenticated
        )

        if (!authenticated) {
          router.replace(ROUTES.AUTH.LOGIN)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown auth check error'
        Sentry.addBreadcrumb({
          category: 'auth',
          level: 'error',
          message: '[TabLayout] Auth check threw',
          data: { errorMessage },
        })
        setIsAuthenticated(prev => (prev === false ? prev : false))
        Sentry.captureException(error, {
          tags: { operation: 'tabLayoutAuthCheck' },
          extra: { message: '[TabLayout] Auth check failed' },
        })

        router.replace(ROUTES.AUTH.LOGIN)
      }
    }

    checkAuthStatus()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const authenticated = !!session?.user
      Sentry.addBreadcrumb({
        category: 'auth',
        level: 'info',
        message: '[TabLayout] onAuthStateChange',
        data: {
          event,
          authenticated,
        },
      })
      setIsAuthenticated(prev =>
        prev === authenticated ? prev : authenticated
      )

      if (!authenticated) {
        router.replace(ROUTES.AUTH.LOGIN)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const labelStyle: NativeTabsLabelStyle = useMemo(
    () => ({
      color:
        Platform.OS === 'ios'
          ? DynamicColorIOS({
              dark: Colors.dark.text,
              light: Colors.light.text,
            })
          : colorScheme === 'dark'
            ? Colors.dark.text
            : Colors.light.text,
      tintColor:
        Platform.OS === 'ios'
          ? DynamicColorIOS({
              dark: Colors.dark.tint,
              light: Colors.light.tint,
            })
          : colorScheme === 'dark'
            ? Colors.dark.tint
            : Colors.light.tint,
    }),
    [colorScheme]
  )

  // Show loading while checking authentication and user access level
  if (isAuthenticated === null || userAccessLevel === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Colors[colorScheme ?? 'light'].background,
        }}
      >
        <ActivityIndicator
          size="large"
          color={Colors[colorScheme ?? 'light'].tint}
        />
      </View>
    )
  }

  // Don't render tabs if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null
  }

  return (
    <NativeTabs
      labelStyle={labelStyle as ComponentProps<typeof NativeTabs>['labelStyle']}
      labelVisibilityMode="labeled"
    >
      {/* Primary navigation - left side (the most frequent use) */}
      <TabTrigger
        name="index"
        testID="tab-collections"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <NativeTabs.Trigger.Label>Collections</NativeTabs.Trigger.Label>
        {Platform.OS === 'ios' ? (
          <NativeTabs.Trigger.Icon sf="house.fill" />
        ) : (
          <NativeTabs.Trigger.Icon
            src={
              <NativeTabs.Trigger.VectorIcon family={FontAwesome} name="home" />
            }
          />
        )}
      </TabTrigger>

      {/* Secondary navigation */}
      <TabTrigger
        name="history"
        testID="tab-history"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        {Platform.OS === 'ios' ? (
          <NativeTabs.Trigger.Icon sf="clock.fill" />
        ) : (
          <NativeTabs.Trigger.Icon
            src={
              <NativeTabs.Trigger.VectorIcon
                family={FontAwesome}
                name="history"
              />
            }
          />
        )}
      </TabTrigger>

      <TabTrigger
        name="settings"
        testID="tab-settings"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        {Platform.OS === 'ios' ? (
          <NativeTabs.Trigger.Icon sf="gear" />
        ) : (
          <NativeTabs.Trigger.Icon
            src={
              <NativeTabs.Trigger.VectorIcon family={FontAwesome} name="cog" />
            }
          />
        )}
      </TabTrigger>

      {/* Primary actions - right side for thumb accessibility */}
      <TabTrigger
        name="review"
        testID="tab-review"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      >
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
        {/* Smart badge showing review words count */}
        {reviewWordsCount > 0 && (
          <StyledBadge
            style={[
              styles.reviewBadge,
              {
                backgroundColor:
                  Platform.OS === 'ios'
                    ? DynamicColorIOS({
                        light: Colors.error.DEFAULT,
                        dark: Colors.error.darkMode,
                      })
                    : colorScheme === 'dark'
                      ? Colors.error.darkMode
                      : Colors.error.DEFAULT,
              },
            ]}
          >
            {reviewWordsCount > 99 ? '99+' : reviewWordsCount.toString()}
          </StyledBadge>
        )}
        {Platform.OS === 'ios' ? (
          <NativeTabs.Trigger.Icon sf="brain.head.profile" />
        ) : (
          <NativeTabs.Trigger.Icon
            src={
              <NativeTabs.Trigger.VectorIcon
                family={FontAwesome}
                name="graduation-cap"
              />
            }
          />
        )}
      </TabTrigger>

      <TabTrigger
        name="add-word"
        testID="tab-add-word"
        hidden={userAccessLevel !== 'full_access'}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      >
        <NativeTabs.Trigger.Label>Add Word</NativeTabs.Trigger.Label>
        {Platform.OS === 'ios' ? (
          <NativeTabs.Trigger.Icon sf="plus.circle.fill" />
        ) : (
          <NativeTabs.Trigger.Icon
            src={
              <NativeTabs.Trigger.VectorIcon
                family={FontAwesome}
                name="plus-circle"
              />
            }
          />
        )}
      </TabTrigger>
    </NativeTabs>
  )
}

const styles = StyleSheet.create({
  // HIG-compliant badge styling for review count with platform-specific colors
  reviewBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -8,
    right: -8,
    borderWidth: 2,
    borderColor:
      Platform.OS === 'ios'
        ? DynamicColorIOS({
            light: Colors.background.primary,
            dark: Colors.dark.background,
          })
        : Colors.background.primary,
    shadowColor: Platform.OS === 'ios' ? PlatformColor('systemGray') : '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0.3 : 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
})
