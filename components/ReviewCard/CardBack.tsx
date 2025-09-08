import React from 'react'
import { StyleSheet, ScrollView } from 'react-native'
import { WordHeader } from './WordHeader'
import { TranslationsSection } from './TranslationsSection'
import { ImageSection } from './ImageSection'
import { ExamplesSection } from './ExamplesSection'
import type { CardBackProps } from './types'

export function CardBack({
  currentWord,
  onChangeImage,
  isPlayingAudio,
  onPlayPronunciation,
}: CardBackProps) {
  return (
    <ScrollView style={styles.cardBack} showsVerticalScrollIndicator={false}>
      <WordHeader
        currentWord={currentWord}
        isPlayingAudio={isPlayingAudio}
        onPlayPronunciation={onPlayPronunciation}
      />

      <TranslationsSection currentWord={currentWord} />

      <ImageSection currentWord={currentWord} onChangeImage={onChangeImage} />

      <ExamplesSection currentWord={currentWord} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  cardBack: {
    flex: 1,
    padding: 4,
  },
})
