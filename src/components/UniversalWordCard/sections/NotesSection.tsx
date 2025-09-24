import React from 'react'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'
import { isGeminiAnalysisResult } from '../types'

export function NotesSection({ word, config }: WordSectionProps) {
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
        >
          {hasNotes ? notes : 'No analysis notes available'}
        </TextThemed>
      </ViewThemed>
    </ViewThemed>
  )
}
