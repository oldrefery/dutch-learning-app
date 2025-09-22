import React from 'react'
import { TouchableOpacity } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
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

      <TouchableOpacity style={styles.notesContainer} activeOpacity={0.7}>
        <TextThemed
          style={[styles.notesText, !hasNotes && styles.notesPlaceholder]}
          selectable={hasNotes}
        >
          {hasNotes ? notes : 'No analysis notes available'}
        </TextThemed>
      </TouchableOpacity>
    </ViewThemed>
  )
}
