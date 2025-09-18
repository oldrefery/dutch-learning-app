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

// Default configuration - максимальная информация
const FULL_CONFIG: WordCardConfig = {
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
  config,
  actions = DEFAULT_ACTIONS,
  isPlayingAudio = false,
  onPlayPronunciation,
  onChangeImage,
  style,
  contentStyle,
}: UniversalWordCardProps) {
  if (!word) {
    return null
  }

  // Merge with full config - максимальная информация по умолчанию
  const finalConfig = { ...FULL_CONFIG, ...config }
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

// Preset configurations - показывают только отличия от FULL_CONFIG
export const WordCardPresets = {
  // Полная конфигурация (по умолчанию) - максимальная информация
  full: {
    config: {}, // Без изменений = максимальная информация
    actions: {},
  },

  // For word detail modal (from collections) - добавляем прогресс и статус
  modal: {
    config: {
      scrollable: false, // Modal handles scrolling
    },
    actions: {
      showProgressInfo: true, // + прогресс обучения
      showStatusInfo: true, // + статус следующего повтора
    },
  },

  // For word analysis (add word screen) - добавляем проверку дубликатов
  analysis: {
    config: {}, // Максимальная информация
    actions: {
      showDuplicateCheck: true, // + проверка дубликатов
      showSaveButton: true, // + кнопка сохранения
    },
  },

  // For review card back - убираем лишнее для фокуса на изучении
  review: {
    config: {
      showSynonyms: false, // - убираем синонимы (отвлекают)
      showAntonyms: false, // - убираем антонимы (отвлекают)
      showGrammarInfo: false, // - убираем грамматику (уже на лицевой стороне)
      showConjugation: false, // - убираем спряжения (слишком много)
      compact: false, // + используем полный размер для review
    },
    actions: {
      showDeleteButton: true, // + кнопка удаления
    },
  },

  // Compact version for lists - минимум информации
  compact: {
    config: {
      showExamples: false, // - убираем примеры
      showImage: false, // - убираем изображение
      showSynonyms: false, // - убираем синонимы
      showAntonyms: false, // - убираем антонимы
      showConjugation: false, // - убираем спряжения
      enableImageChange: false, // - запрещаем смену картинок
      scrollable: false, // - без скролла
      compact: true, // + компактный вид
    },
    actions: {},
  },
} as const
