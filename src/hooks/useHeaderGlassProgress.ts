import { useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { GlassDefaults } from '@/constants/GlassConstants'

export type HeaderGlassProgressOptions = {
  startOffset?: number
  endOffset?: number
  easing?: 'linear' | 'easeOut' | 'easeInOut'
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function ease(progress: number, mode: HeaderGlassProgressOptions['easing']) {
  switch (mode) {
    case 'easeOut':
      // cubic ease out
      return 1 - Math.pow(1 - progress, 3)
    case 'easeInOut':
      // cubic ease in-out
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2
    case 'linear':
    default:
      return progress
  }
}

/**
 * Returns header blur progress [0..1] and resolved blur intensity based on scroll offset.
 * Use with scrollY from the list onScroll events.
 */
export function useHeaderGlassProgress(
  scrollY: number,
  options: HeaderGlassProgressOptions = {}
) {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'

  const {
    startOffset = 0,
    endOffset = 64, // ~navigation bar height
    easing: easingMode = 'easeOut',
  } = options

  return useMemo(() => {
    const raw = (scrollY - startOffset) / Math.max(1, endOffset - startOffset)
    const clamped = clamp(raw, 0, 1)
    const progress = ease(clamped, easingMode)

    const maxIntensity = isDarkMode
      ? GlassDefaults.intensityDark
      : GlassDefaults.intensityLight
    const intensity = Math.round(maxIntensity * progress)

    return { progress, intensity }
  }, [scrollY, startOffset, endOffset, easingMode, isDarkMode])
}

export default useHeaderGlassProgress
