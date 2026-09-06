import { act, renderHook } from '@testing-library/react'
import { clearWebSettings } from './settings-storage'
import { useWebSettings } from './useWebSettings'

const addEventListener = jest.fn()
const removeEventListener = jest.fn()
const matchMedia = jest.fn(() => ({
  matches: false,
  media: '(prefers-color-scheme: dark)',
  onchange: null,
  addEventListener,
  removeEventListener,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  dispatchEvent: jest.fn(),
}))

describe('useWebSettings', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    })
  })

  beforeEach(() => {
    window.localStorage.clear()
    clearWebSettings('settings-user')
    addEventListener.mockClear()
    removeEventListener.mockClear()
    matchMedia.mockClear()
  })

  test('hydrates defaults and persists updates', () => {
    const { result } = renderHook(() => useWebSettings('settings-user'))

    expect(result.current.isHydrated).toBe(true)
    expect(result.current.settings.theme).toBe('system')

    act(() => {
      result.current.update({
        autoPlayPronunciation: true,
        theme: 'dark',
        manualRecognition: true,
      })
    })

    expect(result.current.settings).toMatchObject({
      manualRecognition: true,
      autoPlayPronunciation: true,
      theme: 'dark',
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('woordenaar:web:theme')).toBe('dark')
    expect(
      JSON.parse(
        window.localStorage.getItem('woordenaar:web:settings:settings-user') ??
          '{}'
      )
    ).toMatchObject({ manualRecognition: true })
  })

  test('manual recognition preference is isolated by account', () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useWebSettings(userId),
      { initialProps: { userId: 'settings-user' } }
    )
    act(() => result.current.update({ manualRecognition: true }))
    rerender({ userId: 'different-settings-user' })
    expect(result.current.settings.manualRecognition).toBe(false)
    rerender({ userId: 'settings-user' })
    expect(result.current.settings.manualRecognition).toBe(true)
  })

  test('subscribes to system theme changes and cleans up', () => {
    const { unmount } = renderHook(() => useWebSettings('settings-user'))

    expect(addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    )
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    )
  })
})
