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
      result.current.update({ autoPlayPronunciation: true, theme: 'dark' })
    })

    expect(result.current.settings).toMatchObject({
      autoPlayPronunciation: true,
      theme: 'dark',
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('woordenaar:web:theme')).toBe('dark')
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
