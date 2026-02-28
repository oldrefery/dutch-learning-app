/**
 * Jest Setup File
 * Runs before ALL tests
 * Used for global mocks, configuration, and setup
 */

// ============ TESTING LIBRARY MATCHERS ============
// Built-in matchers from @testing-library/react-native v13+
// Replaces deprecated @testing-library/jest-native
import * as matchers from '@testing-library/react-native/matchers'

expect.extend(matchers)

// ============ ENVIRONMENT VARIABLES ============

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.EXPO_PUBLIC_DEV_USER_EMAIL = 'test@example.com'
process.env.EXPO_PUBLIC_DEV_USER_PASSWORD = 'test-password'
process.env.EXPO_PUBLIC_DEV_USER_ID = 'test-user-id'

// ============ MOCK EXPO MODULES ============

// Mock expo-constants
jest.mock('expo-constants', () => ({
  manifest: {
    version: '1.0.0',
    releaseChannel: 'default',
  },
  getAppOwnershipType: jest.fn(() => 'expo'),
}))

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}))

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}))

// Mock expo-updates
jest.mock('expo-updates', () => ({
  isEnabled: false,
  isEmbeddedLaunch: true,
  updateId: null,
  channel: null,
  runtimeVersion: null,
  checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable: false }),
  fetchUpdateAsync: jest.fn().mockResolvedValue({ isNew: false }),
  reloadAsync: jest.fn(),
}))

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  getRandomBytesAsync: jest.fn(),
  randomUUID: () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
    SHA512: 'SHA-512',
  },
}))

// Note: expo-notifications is not installed, skip mocking for now

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
  // SDK 55+ Color API mock
  Color: {
    android: {
      dynamic: {
        primary: '#6200EE',
        onPrimary: '#FFFFFF',
        secondary: '#03DAC6',
        onSecondary: '#000000',
        surface: '#FFFFFF',
        onSurface: '#000000',
        background: '#FFFFFF',
        onBackground: '#000000',
        error: '#B00020',
        onError: '#FFFFFF',
      },
    },
    ios: {
      label: '#000000',
      secondaryLabel: '#3C3C43',
      tertiaryLabel: '#3C3C4399',
      systemBackground: '#FFFFFF',
      secondarySystemBackground: '#F2F2F7',
      systemBlue: '#007AFF',
      systemRed: '#FF3B30',
      systemGreen: '#34C759',
    },
  },
}))

// ============ MOCK REACT NATIVE MODULES ============

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn(() => ({
    setString: jest.fn(),
    getString: jest.fn().mockReturnValue(null),
    setNumber: jest.fn(),
    getNumber: jest.fn().mockReturnValue(null),
    delete: jest.fn(),
    getAllKeys: jest.fn(() => []),
    clearAll: jest.fn(),
  })),
}))

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}))

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: jest.fn,
    Tap: jest.fn,
    Swipe: jest.fn,
  },
  GestureHandlerRootView: jest.fn(({ children }) => children),
}))

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  Animated: {
    Value: jest.fn(),
    timing: jest.fn(),
    spring: jest.fn(),
  },
  Easing: {},
  useSharedValue: jest.fn(initialValue => ({ value: initialValue })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn(),
  withSpring: jest.fn(),
  runOnJS: jest.fn(callback => callback),
  createAnimatedComponent: jest.fn(Component => Component),
}))

// Mock expo-audio
jest.mock('expo-audio', () => ({
  Sound: {
    createAsync: jest.fn().mockResolvedValue({
      sound: {
        playAsync: jest.fn(),
        stopAsync: jest.fn(),
        unloadAsync: jest.fn(),
        getStatusAsync: jest.fn(),
      },
    }),
  },
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn(),
  },
}))

// Mock @gorhom/bottom-sheet
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: jest.fn(({ children }) => children),
  BottomSheetView: jest.fn(({ children }) => children),
  useBottomSheetModal: jest.fn(() => ({
    dismiss: jest.fn(),
    present: jest.fn(),
  })),
  useBottomSheetInternal: jest.fn(() => ({
    animatedIndex: jest.fn(),
    snapToIndex: jest.fn(),
  })),
}))

// ============ MOCK THIRD-PARTY SERVICES ============

// Mock Sentry (error tracking)
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  reactNativeTracingIntegration: jest.fn(() => ({})),
  mobileReplayIntegration: jest.fn(() => ({})),
}))

// Mock Supabase Sentry integration
jest.mock('@supabase/sentry-js-integration', () => ({
  supabaseIntegration: jest.fn(() => ({})),
}))

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
    hide: jest.fn(),
  },
  Toast: {
    show: jest.fn(),
    hide: jest.fn(),
  },
}))

// ============ SUPPRESS EXPECTED WARNINGS ============

const originalWarn = console.warn
const originalError = console.error

beforeAll(() => {
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString?.() || ''

    if (
      message.includes('VirtualizedList') ||
      message.includes('Setting a timer') ||
      message.includes('Non-serializable values') ||
      message.includes('Cannot update a component')
    ) {
      return
    }

    originalWarn.call(console, ...args)
  }

  console.error = (...args: any[]) => {
    const message = args[0]?.toString?.() || ''

    if (message.includes('Animated: `')) {
      return
    }

    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
  console.error = originalError
})

// ============ GLOBAL TEST UTILITIES ============

jest.setTimeout(10000)

global.fetch = jest.fn()
global.XMLHttpRequest = jest.fn() as any

// Mock global crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
  },
})
