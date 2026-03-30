/**
 * Tests for useImageSelector hook
 *
 * Simple state manager for image selector visibility.
 * Provides open/close/set handlers around a boolean state.
 */

import { renderHook, act } from '@testing-library/react-native'
import { useImageSelector } from '../useImageSelector'

describe('useImageSelector', () => {
  it('should default showImageSelector to false', () => {
    const { result } = renderHook(() => useImageSelector())

    expect(result.current.showImageSelector).toBe(false)
  })

  it('should open image selector', () => {
    const { result } = renderHook(() => useImageSelector())

    act(() => {
      result.current.openImageSelector()
    })

    expect(result.current.showImageSelector).toBe(true)
  })

  it('should close image selector', () => {
    const { result } = renderHook(() => useImageSelector())

    act(() => {
      result.current.openImageSelector()
    })

    act(() => {
      result.current.closeImageSelector()
    })

    expect(result.current.showImageSelector).toBe(false)
  })

  it('should set showImageSelector directly', () => {
    const { result } = renderHook(() => useImageSelector())

    act(() => {
      result.current.setShowImageSelector(true)
    })

    expect(result.current.showImageSelector).toBe(true)

    act(() => {
      result.current.setShowImageSelector(false)
    })

    expect(result.current.showImageSelector).toBe(false)
  })

  it('should return all expected properties', () => {
    const { result } = renderHook(() => useImageSelector())

    expect(result.current).toHaveProperty('showImageSelector')
    expect(result.current).toHaveProperty('setShowImageSelector')
    expect(result.current).toHaveProperty('openImageSelector')
    expect(result.current).toHaveProperty('closeImageSelector')
  })
})
