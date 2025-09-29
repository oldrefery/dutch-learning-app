import React, { useEffect, useState } from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs'
import { router } from 'expo-router'
import {
  ActivityIndicator,
  View,
  useColorScheme,
  StyleSheet,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

import { Colors } from '@/constants/Colors'
import { useClientOnlyValue } from '@/components/useClientOnlyValue'
import { supabase } from '@/lib/supabaseClient'
import { ROUTES } from '@/constants/Routes'

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

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
          console.error('❌ [TabLayout] Session check error:', error)
          setIsAuthenticated(false)
          return
        }

        const authenticated = !!session?.user
        console.log('🔍 [TabLayout] Auth check result:', {
          authenticated,
          userId: session?.user?.id,
        })

        setIsAuthenticated(authenticated)

        if (!authenticated) {
          console.log('🚫 [TabLayout] Not authenticated, redirecting to login')
          router.replace(ROUTES.AUTH.LOGIN)
        }
      } catch (error) {
        console.error('❌ [TabLayout] Auth check failed:', error)
        setIsAuthenticated(false)
        router.replace(ROUTES.AUTH.LOGIN)
      }
    }

    checkAuthStatus()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 [TabLayout] Auth state changed:', {
        event,
        userId: session?.user?.id,
      })
      const authenticated = !!session?.user
      setIsAuthenticated(authenticated)

      if (!authenticated) {
        console.log(
          '🚫 [TabLayout] Auth state changed to unauthenticated, redirecting'
        )
        router.replace(ROUTES.AUTH.LOGIN)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Show loading while checking authentication
  if (isAuthenticated === null) {
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
    <NativeTabs>
      {/* Navigation tabs - left side following HIG order */}
      <NativeTabs.Trigger
        name="index"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Label>Collections</Label>
        {Platform.OS === 'ios' ? (
          <Icon sf="house.fill" />
        ) : (
          <FontAwesome name="home" size={24} />
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="settings"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Label>Settings</Label>
        {Platform.OS === 'ios' ? (
          <Icon sf="gear" />
        ) : (
          <FontAwesome name="cog" size={24} />
        )}
      </NativeTabs.Trigger>

      {/* Primary action tabs - right side following HIG guidelines */}
      <NativeTabs.Trigger
        name="add-word"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      >
        <Label>Add Word</Label>
        {Platform.OS === 'ios' ? (
          <Icon sf="plus.circle.fill" />
        ) : (
          <View
            style={[
              styles.primaryIconContainer,
              {
                shadowColor: Colors.primary.DEFAULT,
                shadowOpacity: 0.3,
              },
            ]}
          >
            <BlurView
              style={styles.primaryIconBlur}
              intensity={80}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
            >
              <View style={[styles.primaryIconInner]}>
                <FontAwesome
                  name="plus"
                  size={22}
                  color={Colors.primary.DEFAULT}
                  style={styles.primaryIcon}
                />
              </View>
            </BlurView>
          </View>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="review"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      >
        <Label>Review</Label>
        {Platform.OS === 'ios' ? (
          <Icon sf="brain.head.profile" />
        ) : (
          <View
            style={[
              styles.primaryIconContainer,
              {
                shadowColor: Colors.primary.DEFAULT,
                shadowOpacity: 0.3,
              },
            ]}
          >
            <BlurView
              style={styles.primaryIconBlur}
              intensity={80}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
            >
              <View style={[styles.primaryIconInner]}>
                <FontAwesome
                  name="graduation-cap"
                  size={20}
                  color={Colors.primary.DEFAULT}
                  style={styles.primaryIcon}
                />
              </View>
            </BlurView>
          </View>
        )}
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

const styles = StyleSheet.create({
  // HIG compliant 46x46 primary icon container for liquid glass effect
  primaryIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginBottom: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    shadowColor: Colors.primary.DEFAULT,
    shadowOpacity: 0.3,
  },
  primaryIconBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    overflow: 'hidden',
  },
  primaryIconInner: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
