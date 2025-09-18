import React from 'react'
import { ScrollView } from 'react-native'
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
  ActionsSection,
} from './sections'

// Default configurations
const DEFAULT_CONFIG: WordCardConfig = {
  showHeader: true,
  showTranslations: true,
  showExamples: true,
  showImage: true,
  showSynonyms: true,
  showAntonyms: true,
  showGrammarInfo: true,
  showConjugation: true,
  enablePronunciation: true,
  enableImageChange: true,
  scrollable: true,
  compact: false,
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
  config = DEFAULT_CONFIG,
  actions = DEFAULT_ACTIONS,
  isPlayingAudio = false,
  onPlayPronunciation,
  onChangeImage,
  style,
  contentStyle,
}: UniversalWordCardProps) {
  // Merge with default configs
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const finalActions = { ...DEFAULT_ACTIONS, ...actions }

  const sectionProps = {
    word,
    config: finalConfig,
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
      <HeaderSection {...sectionProps} />
      <TranslationsSection {...sectionProps} />
      <ExamplesSection {...sectionProps} />
      <ImageSection {...sectionProps} />
      <SynonymsAntonymsSection {...sectionProps} />
      <ConjugationSection {...sectionProps} />
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

// Preset configurations for common use cases
export const WordCardPresets = {
  // For word detail modal (from collections)
  modal: {
    config: {
      showHeader: true,
      showTranslations: true,
      showExamples: true,
      showImage: true,
      showSynonyms: true,
      showAntonyms: true,
      showGrammarInfo: true,
      showConjugation: true,
      enablePronunciation: true,
      enableImageChange: true,
      scrollable: false, // Modal handles scrolling
      compact: false,
    },
    actions: {
      showProgressInfo: true,
      showStatusInfo: true,
    },
  },

  // For word analysis (add word screen)
  analysis: {
    config: {
      showHeader: true,
      showTranslations: true,
      showExamples: true,
      showImage: true,
      showSynonyms: true,
      showAntonyms: true,
      showGrammarInfo: true,
      showConjugation: true,
      enablePronunciation: true,
      enableImageChange: true,
      scrollable: true,
      compact: false,
    },
    actions: {
      showDuplicateCheck: true,
      showSaveButton: true,
    },
  },

  // For review card back
  review: {
    config: {
      showHeader: true,
      showTranslations: true,
      showExamples: true,
      showImage: true,
      showSynonyms: false, // Keep review focused
      showAntonyms: false,
      showGrammarInfo: false,
      showConjugation: false,
      enablePronunciation: true,
      enableImageChange: true,
      scrollable: true,
      compact: true,
    },
    actions: {
      showDeleteButton: true,
    },
  },

  // Compact version for lists or smaller spaces
  compact: {
    config: {
      showHeader: true,
      showTranslations: true,
      showExamples: false,
      showImage: false,
      showSynonyms: false,
      showAntonyms: false,
      showGrammarInfo: true,
      showConjugation: false,
      enablePronunciation: true,
      enableImageChange: false,
      scrollable: false,
      compact: true,
    },
    actions: {},
  },
} as const
