import * as SentryLib from '@sentry/react-native'
import { initializeSentry } from '../sentry'

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { qaBuild: true } } },
}))
jest.mock('../supabaseClient', () => ({ supabase: { from: jest.fn() } }))

it('does not initialize live telemetry for fixed-bundle QA, including explicit retries', () => {
  initializeSentry()
  initializeSentry()
  expect(SentryLib.init).not.toHaveBeenCalled()
})
