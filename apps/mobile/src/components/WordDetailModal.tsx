import React, { useMemo, useEffect, useCallback } from 'react'
import {
  TouchableOpacity,
  Dimensions,
  StatusBar,
  useColorScheme,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useAudio } from '@/contexts/AudioContext'
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
  onChangeImage?: () => void
  onDeleteWord?: () => void
  onReanalyzeWord?: () => void
  isReanalyzing?: boolean
}

const { height: screenHeight } = Dimensions.get('window')

export default function WordDetailModal({
  visible,
  onClose,
  word,
  onChangeImage,
  onDeleteWord,
  onReanalyzeWord,
  isReanalyzing = false,
}: WordDetailModalProps) {
  const translateY = useSharedValue(screenHeight)
  const backdropOpacity = useSharedValue(0)
  const scrollOffset = useSharedValue(0)
  const isDragging = useSharedValue(false)
  const colorScheme = useColorScheme() ?? 'light'
  const { playWord, isPlaying } = useAudio()

  const handlePlayAudio = useCallback(async () => {
    if (!word?.dutch_lemma) return
    await playWord(word.dutch_lemma, word.tts_url)
  }, [playWord, word])

  // Create a native gesture for ScrollView
  const nativeScrollGesture = useMemo(() => Gesture.Native(), [])

  // Animate modal appearance
  useEffect(() => {
    if (visible) {
      translateY.set(withSpring(0, { damping: 20, stiffness: 300 }))
      backdropOpacity.set(withTiming(1, { duration: 300 }))
    } else {
      translateY.set(withTiming(screenHeight, { duration: 300 }))
      backdropOpacity.set(withTiming(0, { duration: 300 }))
    }
  }, [backdropOpacity, translateY, visible])

  // Handle closing modal
  const closeModal = useCallback(() => {
    translateY.set(withTiming(screenHeight, { duration: 300 }))
    backdropOpacity.set(
      withTiming(0, { duration: 300 }, () => {
        scheduleOnRN(onClose)
      })
    )
  }, [translateY, backdropOpacity, onClose])

  // Gesture for closing modal with swipe down
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate(event => {
          'worklet'
          // Start dismissing gesture only if:
          // 1. We're at the top of the scroll AND
          // 2. Moving down (positive translationY) AND
          // 3. Have moved at least 10 px down to confirm intent
          if (scrollOffset.get() <= 0 && event.translationY > 10) {
            isDragging.set(true)
            translateY.set(event.translationY)
            // Update backdrop opacity based on drag distance
            const progress = Math.min(event.translationY / screenHeight, 1)
            backdropOpacity.set(
              interpolate(progress, [0, 1], [1, 0], Extrapolation.CLAMP)
            )
          } else if (event.translationY <= 0) {
            // Reset if moving up
            isDragging.set(false)
            translateY.set(0)
            backdropOpacity.set(1)
          }
        })
        .onEnd(event => {
          'worklet'
          if (!isDragging.get()) return

          // Closing conditions: significant distance OR high velocity
          const dismissThreshold = screenHeight * 0.2 // 20% of screen height
          const shouldClose =
            translateY.get() > dismissThreshold || event.velocityY > 800

          if (shouldClose) {
            scheduleOnRN(closeModal)
          } else {
            // Return to the original position if not closed
            translateY.set(withSpring(0))
            backdropOpacity.set(withTiming(1))
          }

          isDragging.set(false)
        })
        // Link with native scroll gesture
        .simultaneousWithExternalGesture(nativeScrollGesture),
    [
      scrollOffset,
      isDragging,
      translateY,
      backdropOpacity,
      closeModal,
      nativeScrollGesture,
    ]
  )

  // Simple handler for tracking scroll position
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollOffset.set(event.contentOffset.y)
    },
  })

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.get() }],
    }
  })

  const animatedBackdropStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.get(),
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
          <Animated.View
            style={[
              styles.container,
              animatedContainerStyle,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.background
                    : Colors.light.background,
              },
            ]}
          >
            <ViewThemed style={styles.dragIndicator} />
            <WordDetailHeader
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
                    enablePronunciation: true, // Enable audio button
                  }}
                  actions={{
                    ...WordCardPresets.modal.actions,
                    onDelete: onDeleteWord,
                    showReanalyzeButton: true,
                    onReanalyze: onReanalyzeWord,
                    isReanalyzing: isReanalyzing,
                  }}
                  isPlayingAudio={isPlaying}
                  onPlayPronunciation={handlePlayAudio}
                  onChangeImage={onChangeImage}
                />
              </Animated.ScrollView>
            </GestureDetector>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </>
  )
}
