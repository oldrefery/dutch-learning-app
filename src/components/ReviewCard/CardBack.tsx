import React from 'react'
import { StyleSheet, ScrollView, Alert, View } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { WordHeader } from './WordHeader'
import { TranslationsSection } from './TranslationsSection'
import { ImageSection } from './ImageSection'
import { ExamplesSection } from './ExamplesSection'
import { Colors } from '@/constants/Colors'
import type { CardBackProps } from './types'

interface CardBackPropsWithRef extends CardBackProps {
  pronunciationRef?: React.RefObject<View | null>
}

export function CardBack({
  currentWord,
  onChangeImage,
  isPlayingAudio,
  onPlayPronunciation,
  onDeleteWord,
  pronunciationRef,
}: CardBackPropsWithRef) {
  return (
    <ScrollView style={styles.cardBack} showsVerticalScrollIndicator={false}>
      <WordHeader
        currentWord={currentWord}
        isPlayingAudio={isPlayingAudio}
        onPlayPronunciation={onPlayPronunciation}
        pronunciationRef={pronunciationRef}
      />

      <TranslationsSection currentWord={currentWord} />

      <ImageSection currentWord={currentWord} onChangeImage={onChangeImage} />

      <ExamplesSection currentWord={currentWord} />

      {/* Delete Word Button */}
      <Pressable
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            'Delete Word',
            `Are you sure you want to delete "${currentWord.dutch_lemma}"?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: onDeleteWord,
              },
            ]
          )
        }}
      >
        <Ionicons name="trash-outline" size={20} color={Colors.error.DEFAULT} />
        <TextThemed style={styles.deleteButtonText}>Delete Word</TextThemed>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  cardBack: {
    flex: 1,
    padding: 32,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error.light,
    borderWidth: 1,
    borderColor: Colors.error.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginHorizontal: 8,
  },
  deleteButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.error.DEFAULT,
  },
})
