import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function usePreferReducedTransparency() {
  const [reduceTransparencyEnabled, setReduceTransparencyEnabled] =
    useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      // There is no direct RN API for reduce transparency; as a proxy, we can honor reduce motion
      if (mounted) setReduceTransparencyEnabled(Boolean(value))
    })
    return () => {
      mounted = false
    }
  }, [])

  return reduceTransparencyEnabled
}

export default usePreferReducedTransparency
