import React, { useState, useCallback } from 'react'
import { LayoutChangeEvent, Pressable, useColorScheme } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles, notesExpandableStyles } from '../styles'
import type { WordSectionProps } from '../types'
import { isGeminiAnalysisResult } from '../types'

// Threshold in pixels for when to show expand/collapse
const COLLAPSED_HEIGHT = 100
const COLLAPSED_LINES = 4

export function NotesSection({ word, config }: WordSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [needsExpansion, setNeedsExpansion] = useState(false)
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const colorScheme = useColorScheme()

  const handleTextLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout
      if (measuredHeight === 0) {
        setMeasuredHeight(height)
        // If content height exceeds collapsed height, enable expansion
        if (height > COLLAPSED_HEIGHT) {
          setNeedsExpansion(true)
        }
      }
    },
    [measuredHeight]
  )

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const expandButtonTextColor =
    colorScheme === 'dark' ? Colors.primary.darkMode : Colors.primary.DEFAULT

  if (!config.showNotes) return null

  const notes = isGeminiAnalysisResult(word) ? word.analysis_notes || '' : ''
  const hasNotes = notes.trim().length > 0

  return (
    <ViewThemed
      style={[styles.section, config.compact && styles.compactSection]}
    >
      <TextThemed
        style={[
          styles.sectionTitle,
          config.compact && styles.compactSectionTitle,
        ]}
      >
        <TextThemed style={styles.sectionIcon}>📝</TextThemed>
        Analysis Notes
      </TextThemed>

      <ViewThemed
        style={styles.notesContainer}
        lightColor={hasNotes ? undefined : Colors.light.backgroundSecondary}
        darkColor={hasNotes ? undefined : Colors.dark.backgroundSecondary}
      >
        <TextThemed
          style={[styles.notesText, !hasNotes && styles.notesPlaceholder]}
          selectable={hasNotes}
          numberOfLines={
            hasNotes && needsExpansion && !isExpanded
              ? COLLAPSED_LINES
              : undefined
          }
          onLayout={hasNotes ? handleTextLayout : undefined}
        >
          {hasNotes ? notes : 'No analysis notes available'}
        </TextThemed>

        {hasNotes && needsExpansion && (
          <Pressable
            onPress={toggleExpanded}
            style={notesExpandableStyles.expandButton}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Collapse notes' : 'Expand notes'}
          >
            <TextThemed
              style={[
                notesExpandableStyles.expandButtonText,
                { color: expandButtonTextColor },
              ]}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </TextThemed>
          </Pressable>
        )}
      </ViewThemed>
    </ViewThemed>
  )
}
