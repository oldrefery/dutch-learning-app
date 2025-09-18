import React, { useEffect } from 'react'
import { TouchableOpacity, Dimensions, StatusBar } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated'
import { ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Word } from '@/types/database'
import {
  UniversalWordCard,
  WordCardPresets,
} from '@/components/UniversalWordCard'
import { styles } from './WordDetailModal/styles'
import { WordDetailHeader } from './WordDetailModal/components'

interface WordDetailModalProps {
  visible: boolean
  onClose: () => void
  word: Word | null
}

const { height: screenHeight } = Dimensions.get('window')

export default function WordDetailModal({
  visible,
  onClose,
  word,
}: WordDetailModalProps) {
  const translateY = useSharedValue(screenHeight)
  const backdropOpacity = useSharedValue(0)
  const scrollOffset = useSharedValue(0)
  const isDragging = useSharedValue(false)

  // Create a native gesture for ScrollView
  const nativeScrollGesture = Gesture.Native()

  // Animate modal appearance
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 })
      backdropOpacity.value = withTiming(1, { duration: 300 })
    } else {
      translateY.value = withTiming(screenHeight, { duration: 300 })
      backdropOpacity.value = withTiming(0, { duration: 300 })
    }
  }, [backdropOpacity, translateY, visible])

  // Handle closing modal
  const closeModal = () => {
    translateY.value = withTiming(screenHeight, { duration: 300 })
    backdropOpacity.value = withTiming(0, { duration: 300 }, () => {
      runOnJS(onClose)()
    })
  }

  // Gesture for closing modal with swipe down
  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet'
      // Start dismissing gesture only if:
      // 1. We're at the top of the scroll AND
      // 2. Moving down (positive translationY) AND
      // 3. Have moved at least 10 px down to confirm intent
      if (scrollOffset.value <= 0 && event.translationY > 10) {
        isDragging.value = true
        translateY.value = event.translationY
        // Update backdrop opacity based on drag distance
        const progress = Math.min(event.translationY / screenHeight, 1)
        backdropOpacity.value = interpolate(
          progress,
          [0, 1],
          [1, 0],
          Extrapolation.CLAMP
        )
      } else if (event.translationY <= 0) {
        // Reset if moving up
        isDragging.value = false
        translateY.value = 0
        backdropOpacity.value = 1
      }
    })
    .onEnd(event => {
      'worklet'
      if (!isDragging.value) return

      // Closing conditions: significant distance OR high velocity
      const dismissThreshold = screenHeight * 0.2 // 20% of screen height
      const shouldClose =
        translateY.value > dismissThreshold || event.velocityY > 800

      if (shouldClose) {
        runOnJS(closeModal)()
      } else {
        // Return to the original position if not closed
        translateY.value = withSpring(0)
        backdropOpacity.value = withTiming(1)
      }

      isDragging.value = false
    })
    // Link with native scroll gesture
    .simultaneousWithExternalGesture(nativeScrollGesture)

  // Simple handler for tracking scroll position
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollOffset.value = event.contentOffset.y
    },
  })

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    }
  })

  const animatedBackdropStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.value,
    }
  })

  if (!word) {
    return null
  }

  return (
    <>
      <StatusBar
        backgroundColor={Colors.transparent.modalOverlay}
        barStyle="light-content"
      />
      <Animated.View style={[styles.overlay, animatedBackdropStyle]}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeModal}
        />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, animatedContainerStyle]}>
            <ViewThemed style={styles.dragIndicator} />
            <WordDetailHeader
              dutchOriginal={word?.dutch_original || null}
              dutchLemma={word?.dutch_lemma || null}
              article={word?.article || null}
              onClose={closeModal}
            />

            <GestureDetector gesture={nativeScrollGesture}>
              <Animated.ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                bounces={true}
                scrollEventThrottle={16}
                onScroll={scrollHandler}
              >
                <UniversalWordCard
                  word={word}
                  config={{
                    ...WordCardPresets.modal.config,
                    scrollable: false, // Modal handles scrolling
                  }}
                  actions={WordCardPresets.modal.actions}
                />
              </Animated.ScrollView>
            </GestureDetector>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </>
  )
}
