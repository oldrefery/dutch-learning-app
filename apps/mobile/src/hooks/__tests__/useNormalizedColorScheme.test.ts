/**
 * Tests for useNormalizedColorScheme hook
 *
 * Wrapper around React Native's useColorScheme that normalizes
 * null and 'unspecified' values to 'light'.
 *
 * Note: In the test environment (node), useColorScheme returns null,
 * so we test the normalization logic directly.
 */

import { renderHook } from '@testing-library/react-native'
import { useNormalizedColorScheme } from '../useNormalizedColorScheme'

describe('useNormalizedColorScheme', () => {
  it('should return "light" in test environment (null scheme is normalized)', () => {
    const { result } = renderHook(() => useNormalizedColorScheme())

    // In node test env, useColorScheme returns null, which normalizes to 'light'
    expect(result.current).toBe('light')
  })

  it('should only return "light" or "dark"', () => {
    const { result } = renderHook(() => useNormalizedColorScheme())

    expect(['light', 'dark']).toContain(result.current)
  })

  it('should return a string type', () => {
    const { result } = renderHook(() => useNormalizedColorScheme())

    expect(typeof result.current).toBe('string')
  })
})
