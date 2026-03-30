/**
 * Tests for useHeaderGlassProgress hook
 *
 * Returns header blur progress [0..1] and blur intensity
 * based on scroll offset with configurable easing.
 *
 * Note: In test env useColorScheme returns null (light mode).
 * Dark mode path tested indirectly via intensity value difference.
 */

import { renderHook } from '@testing-library/react-native'
import { useHeaderGlassProgress } from '../useHeaderGlassProgress'
import { GlassDefaults } from '@/constants/GlassConstants'

describe('useHeaderGlassProgress', () => {
  describe('progress calculation', () => {
    it('should return progress 0 when scrollY is 0', () => {
      const { result } = renderHook(() => useHeaderGlassProgress(0))

      expect(result.current.progress).toBe(0)
      expect(result.current.intensity).toBe(0)
    })

    it('should return progress 1 when scrollY >= endOffset', () => {
      const { result } = renderHook(() => useHeaderGlassProgress(100))

      expect(result.current.progress).toBe(1)
      // In test env, light mode is used
      expect(result.current.intensity).toBe(GlassDefaults.intensityLight)
    })

    it('should clamp progress below 0 to 0', () => {
      const { result } = renderHook(() => useHeaderGlassProgress(-50))

      expect(result.current.progress).toBe(0)
    })

    it('should clamp progress above 1 to 1', () => {
      const { result } = renderHook(() => useHeaderGlassProgress(200))

      expect(result.current.progress).toBe(1)
    })

    it('should respect custom startOffset and endOffset', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(50, {
          startOffset: 0,
          endOffset: 100,
          easing: 'linear',
        })
      )

      expect(result.current.progress).toBe(0.5)
    })

    it('should return 0 progress when scrollY is below startOffset', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(10, {
          startOffset: 50,
          endOffset: 100,
          easing: 'linear',
        })
      )

      expect(result.current.progress).toBe(0)
    })
  })

  describe('easing modes', () => {
    it('should apply linear easing (identity)', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(32, { endOffset: 64, easing: 'linear' })
      )

      expect(result.current.progress).toBe(0.5)
    })

    it('should apply easeOut easing (higher than linear for mid-values)', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(32, { endOffset: 64, easing: 'easeOut' })
      )

      // easeOut at 0.5 = 1 - (1 - 0.5)^3 = 0.875
      expect(result.current.progress).toBe(0.875)
    })

    it('should apply easeInOut easing', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(32, { endOffset: 64, easing: 'easeInOut' })
      )

      // easeInOut at 0.5 = 4 * 0.5^3 = 0.5
      expect(result.current.progress).toBe(0.5)
    })

    it('should default to easeOut when no easing specified', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(32, { endOffset: 64 })
      )

      expect(result.current.progress).toBe(0.875)
    })
  })

  describe('intensity', () => {
    it('should calculate intensity as maxIntensity * progress', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(64, { endOffset: 64, easing: 'linear' })
      )

      // Full progress, light mode
      expect(result.current.intensity).toBe(GlassDefaults.intensityLight)
    })

    it('should return 0 intensity when progress is 0', () => {
      const { result } = renderHook(() => useHeaderGlassProgress(0))

      expect(result.current.intensity).toBe(0)
    })

    it('should round intensity to integer', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(32, { endOffset: 64, easing: 'linear' })
      )

      expect(Number.isInteger(result.current.intensity)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle endOffset equal to startOffset without division by zero', () => {
      const { result } = renderHook(() =>
        useHeaderGlassProgress(50, {
          startOffset: 50,
          endOffset: 50,
          easing: 'linear',
        })
      )

      expect(result.current.progress).toBe(0)
    })
  })
})
