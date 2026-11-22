/**
 * Tests for useImageSelector hook
 *
 * Simple state manager for image selector visibility.
 * Provides open/close/set handlers around a boolean state.
 */

import { renderHook, act } from '@testing-library/react-native'
import { useImageSelector } from '../useImageSelector'

describe('useImageSelector', () => {
  it('should default showImageSelector to false', async () => {
    const { result } = await renderHook(() => useImageSelector())

    expect(result.current.showImageSelector).toBe(false)
  })

  it('should open image selector', async () => {
    const { result } = await renderHook(() => useImageSelector())

    await act(() => {
      result.current.openImageSelector()
    })

    expect(result.current.showImageSelector).toBe(true)
  })

  it('should close image selector', async () => {
    const { result } = await renderHook(() => useImageSelector())

    await act(() => {
      result.current.openImageSelector()
    })

    await act(() => {
      result.current.closeImageSelector()
    })

    expect(result.current.showImageSelector).toBe(false)
  })

  it('should set showImageSelector directly', async () => {
    const { result } = await renderHook(() => useImageSelector())

    await act(() => {
      result.current.setShowImageSelector(true)
    })

    expect(result.current.showImageSelector).toBe(true)

    await act(() => {
      result.current.setShowImageSelector(false)
    })

    expect(result.current.showImageSelector).toBe(false)
  })

  it('should return all expected properties', async () => {
    const { result } = await renderHook(() => useImageSelector())

    expect(result.current).toHaveProperty('showImageSelector')
    expect(result.current).toHaveProperty('setShowImageSelector')
    expect(result.current).toHaveProperty('openImageSelector')
    expect(result.current).toHaveProperty('closeImageSelector')
  })
})
