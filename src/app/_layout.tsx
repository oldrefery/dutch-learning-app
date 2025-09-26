import FontAwesome from '@expo/vector-icons/FontAwesome'
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import { Sentry } from '@/lib/sentry'
import { AppToast } from '@/components/AppToast'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'

import { useColorScheme } from 'react-native'
import { SimpleAuthProvider } from '@/contexts/SimpleAuthProvider'
import { AudioProvider } from '@/contexts/AudioContext'

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

  // SIMPLE: No session handling, just show auth screens with a simple provider
  return (
    <SimpleAuthProvider>
      <AudioProvider>
        <RootLayoutNav />
      </AudioProvider>
    </SimpleAuthProvider>
  )
})

function RootLayoutNav() {
  const colorScheme = useColorScheme()
  const router = useRouter()

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('🔗 [RootLayoutNav] Deep link received:', url)

      const { hostname, path } = Linking.parse(url)

      // Handle dutchlearning://share/TOKEN
      if (hostname === 'share' && path) {
        const token = path.replace('/', '') // Remove the leading slash
        if (token) {
          console.log('🔗 [RootLayoutNav] Navigating to share screen', {
            token,
          })
          router.push(ROUTES.SHARE_COLLECTION(token))
        }
      }
    }

    // Handle initial URL if app was opened by a deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('🔗 [RootLayoutNav] Initial URL:', url)
        handleDeepLink(url)
      }
    })

    // Handle later deep links while the app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url)
    })

    return () => subscription?.remove()
  }, [router])

  // Create a custom dark theme with our color palette
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
          <Stack.Screen name="share/[token]" options={{ headerShown: true }} />
          <Stack.Screen name="import/[token]" options={{ headerShown: true }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <AppToast />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
