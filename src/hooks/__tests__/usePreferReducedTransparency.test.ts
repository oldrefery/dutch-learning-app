/**
 * Tests for usePreferReducedTransparency hook
 *
 * Uses AccessibilityInfo.isReduceMotionEnabled as a proxy
 * for reduce transparency preference. Handles async state
 * with mounted guard for cleanup safety.
 */

import { renderHook, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { usePreferReducedTransparency } from '../usePreferReducedTransparency'

describe('usePreferReducedTransparency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should default to false', () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(false))

    const { result } = renderHook(() => usePreferReducedTransparency())

    expect(result.current).toBe(false)
  })

  it('should return true when reduce motion is enabled', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(true))

    const { result } = renderHook(() => usePreferReducedTransparency())

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should return false when reduce motion is disabled', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(false))

    const { result } = renderHook(() => usePreferReducedTransparency())

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })

  it('should not update state after unmount', async () => {
    let resolvePromise: (value: boolean) => void
    const pendingPromise = new Promise<boolean>(resolve => {
      resolvePromise = resolve
    })

    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(pendingPromise)

    const { result, unmount } = renderHook(() => usePreferReducedTransparency())

    // Unmount before promise resolves
    unmount()

    // Resolve after unmount — should not cause state update
    resolvePromise!(true)

    // Value should remain false (initial state, no update after unmount)
    expect(result.current).toBe(false)
  })
})
