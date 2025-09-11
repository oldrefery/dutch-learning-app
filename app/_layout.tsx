import FontAwesome from '@expo/vector-icons/FontAwesome'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import * as Sentry from '@sentry/react-native'
import { AppToast } from '@/components/AppToast'

import { useColorScheme } from '@/components/useColorScheme'
import { useAppStore } from '@/stores/useAppStore'

Sentry.init({
  dsn: 'https://b9380e4ad548d88fe5c8bfecabcdf2e3@o4506263035904000.ingest.us.sentry.io/4509999490727936',
  debug: __DEV__,
  integrations: [Sentry.reactNativeTracingIntegration({})],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
}

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

  return <RootLayoutNav />
})

function RootLayoutNav() {
  const colorScheme = useColorScheme()
  const initializeApp = useAppStore(state => state.initializeApp)

  // Initialize app store when component mounts
  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <AppToast />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
