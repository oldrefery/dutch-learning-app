import { createContext } from 'react'
import type { GestureType } from 'react-native-gesture-handler'

/**
 * Provides the parent tap gesture so that child interactive elements
 * (wrapped in NonSwipeableArea) can block it via blocksExternalGesture.
 */
export const ParentGestureContext = createContext<GestureType | null>(null)
