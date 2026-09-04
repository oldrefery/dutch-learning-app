import { createContext } from 'react'
import type { GestureType } from 'react-native-gesture-handler'

/**
 * Provides a ref to the parent tap gesture so that child interactive elements
 * (wrapped in NonSwipeableArea) can block it via blocksExternalGesture.
 */
export const ParentGestureContext = createContext<React.RefObject<
  GestureType | undefined
> | null>(null)
