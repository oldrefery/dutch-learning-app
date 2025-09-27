import React, { useEffect, useState } from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Tabs, router } from 'expo-router'
import { ActivityIndicator, View, useColorScheme } from 'react-native'

import { Colors } from '@/constants/Colors'
import { useClientOnlyValue } from '@/components/useClientOnlyValue'
import { supabase } from '@/lib/supabaseClient'
import { ROUTES } from '@/constants/Routes'

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name']
  color: string
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />
}

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Call this unconditionally to follow the rules of hooks
  const useClientOnly = useClientOnlyValue(false, true)

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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Disable the static render of the header on the web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnly,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Collections',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-word"
        options={{
          title: 'Add Word',
          tabBarIcon: ({ color }) => <TabBarIcon name="plus" color={color} />,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="graduation-cap" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  )
}
