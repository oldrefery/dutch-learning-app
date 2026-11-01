import { act, renderHook } from '@testing-library/react-native'
import { AppState, Platform, type AppStateStatus } from 'react-native'
import { useRuntimeDiagnostics } from '../useRuntimeDiagnostics'
import { Sentry } from '@/lib/sentry'

const mockSegments = ['(tabs)', 'settings']
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }))
jest.mock('@/lib/sentry', () => ({
  Sentry: { setContext: jest.fn(), addBreadcrumb: jest.fn() },
}))

describe('useRuntimeDiagnostics', () => {
  const callbacks: Record<string, (state?: AppStateStatus) => void> = {}
  const removals: jest.Mock[] = []
  const os = Platform.OS

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    removals.length = 0
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
    })
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event, callback) => {
        callbacks[event] = state => {
          if (state) callback(state)
          else (callback as () => void)()
        }
        const remove = jest.fn()
        removals.push(remove)
        return { remove }
      })
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  })

  it('subscribes once, pauses in background and removes observers and timers', () => {
    const { rerender, unmount } = renderHook(() => useRuntimeDiagnostics())
    expect(Sentry.setContext).toHaveBeenLastCalledWith(
      'runtime_diagnostics',
      expect.objectContaining({ route: 'settings' })
    )
    rerender({})
    expect(AppState.addEventListener).toHaveBeenCalledTimes(2)
    expect(jest.getTimerCount()).toBe(1)
    act(() => callbacks.change('background'))
    expect(jest.getTimerCount()).toBe(0)
    act(() => {
      jest.advanceTimersByTime(600000)
      callbacks.change('active')
    })
    expect(jest.getTimerCount()).toBe(1)
    act(() => callbacks.memoryWarning())
    expect(Sentry.setContext).toHaveBeenLastCalledWith(
      'runtime_diagnostics',
      expect.objectContaining({ memory_warning_count: 1, js_stall_count: 0 })
    )
    unmount()
    expect(removals.every(remove => remove.mock.calls.length === 1)).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('does not install native monitoring on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const { unmount } = renderHook(() => useRuntimeDiagnostics())
    expect(AppState.addEventListener).not.toHaveBeenCalled()
    expect(Sentry.setContext).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
    unmount()
  })
})
