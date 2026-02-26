import React from 'react'
import { ScrollView, View } from 'react-native'
import { ViewThemed } from '@/components/Themed'
import { styles } from './styles'
import type {
  UniversalWordCardProps,
  WordCardConfig,
  WordCardActionConfig,
} from './types'
import {
  HeaderSection,
  TranslationsSection,
  ExamplesSection,
  ImageSection,
  SynonymsAntonymsSection,
  ConjugationSection,
  NotesSection,
  ActionsSection,
} from './sections'

// Default configuration
const FULL_CONFIG: WordCardConfig = {
  showHeader: true,
  showTranslations: true,
  showExamples: true,
  showImage: true,
  showSynonyms: true,
  showAntonyms: true,
  showGrammarInfo: true,
  showConjugation: true,
  showNotes: true,
  enablePronunciation: true,
  enableImageChange: true,
  scrollable: true,
  compact: false,
  extraHeightAddWord: 0,
}

const DEFAULT_ACTIONS: WordCardActionConfig = {
  showDeleteButton: false,
  showProgressInfo: false,
  showStatusInfo: false,
  showDuplicateCheck: false,
  showSaveButton: false,
}

export function UniversalWordCard({
  word,
  config,
  actions = DEFAULT_ACTIONS,
  metadata,
  onForceRefresh,
  isPlayingAudio = false,
  onPlayPronunciation,
  onChangeImage,
  style,
  contentStyle,
}: UniversalWordCardProps) {
  if (!word) {
    return null
  }

  // Merge with full config
  const finalConfig = { ...FULL_CONFIG, ...config }
  const finalActions = { ...DEFAULT_ACTIONS, ...actions }

  const sectionProps = {
    word,
    config: finalConfig,
    metadata,
    onForceRefresh,
    isPlayingAudio,
    onPlayPronunciation,
    onChangeImage,
  }

  const content = (
    <ViewThemed
      style={[
        finalConfig.compact ? styles.compactContent : styles.content,
        contentStyle,
      ]}
    >
      <View style={{ height: finalConfig.extraHeightAddWord }} />
      <HeaderSection {...sectionProps} />
      <TranslationsSection {...sectionProps} />
      <ConjugationSection {...sectionProps} />
      <ExamplesSection {...sectionProps} />
      <ImageSection {...sectionProps} />
      <SynonymsAntonymsSection {...sectionProps} />
      <NotesSection {...sectionProps} />
      <ActionsSection word={word} actions={finalActions} />
    </ViewThemed>
  )

  if (finalConfig.scrollable) {
    return (
      <ViewThemed style={[styles.container, style]}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {content}
        </ScrollView>
      </ViewThemed>
    )
  }

  return <ViewThemed style={[styles.container, style]}>{content}</ViewThemed>
}

// Preset configurations
export const WordCardPresets = {
  // Full configuration (default)
  full: {
    config: {},
    actions: {},
  },

  // For word detail modal (from collections)
  modal: {
    config: {
      scrollable: false, // Modal handles scrolling
      showHeader: false,
      enableImageChange: true,
    },
    actions: {
      showProgressInfo: true,
      showStatusInfo: true,
      showDeleteButton: true,
    },
  },

  // For word analysis (add word screen)
  analysis: {
    config: {
      showHeader: false,
    },
    actions: {
      showDuplicateCheck: true,
      showSaveButton: true,
    },
  },

  // For review card back
  review: {
    config: {
      showHeader: false,
      showSynonyms: true,
      showAntonyms: true,
      showGrammarInfo: true,
      showConjugation: true,
      compact: false,
    },
    actions: {
      showDeleteButton: true,
    },
  },

  // Compact version for lists
  compact: {
    config: {
      showExamples: false,
      showImage: false,
      showSynonyms: false,
      showAntonyms: false,
      showConjugation: false,
      showNotes: false,
      enableImageChange: false,
      scrollable: false,
      compact: true,
    },
    actions: {},
  },
} as const
