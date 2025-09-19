import FontAwesome from '@expo/vector-icons/FontAwesome'
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import { Sentry } from '@/lib/sentry'
import { AppToast } from '@/components/AppToast'
import { Colors } from '@/constants/Colors'

import { useColorScheme } from 'react-native'
import { SimpleAuthProvider } from '@/contexts/SimpleAuthProvider'

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router'

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export default Sentry.wrap(function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  })

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  // SIMPLE: No session handling, just show auth screens with simple provider
  return (
    <SimpleAuthProvider>
      <RootLayoutNav />
    </SimpleAuthProvider>
  )
})

function RootLayoutNav() {
  const colorScheme = useColorScheme()

  // Create custom dark theme with our color palette
  const CustomDarkTheme = {
    ...NavigationDarkTheme,
    colors: {
      ...NavigationDarkTheme.colors,
      background: Colors.dark.background, // Our main background #1C1C1E
      card: Colors.dark.backgroundSecondary, // Navigation card background
      text: Colors.dark.text, // Main text
      border: Colors.neutral[700], // Borders (e.g., header bottom)
      primary: Colors.dark.tint, // Active elements
    },
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider
        value={colorScheme === 'dark' ? CustomDarkTheme : DefaultTheme}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="collection/[id]"
            options={{ headerShown: true }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <AppToast />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
