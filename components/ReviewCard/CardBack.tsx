import React from 'react'
import { StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/Themed'
import { WordHeader } from './WordHeader'
import { TranslationsSection } from './TranslationsSection'
import { ImageSection } from './ImageSection'
import { ExamplesSection } from './ExamplesSection'
import { Colors } from '@/constants/Colors'
import type { CardBackProps } from './types'
import type { TapGestureHandler } from 'react-native-gesture-handler'

interface CardBackPropsWithRef extends CardBackProps {
  pronunciationRef?: React.RefObject<TapGestureHandler | null>
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
      <TouchableOpacity
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
        <Text style={styles.deleteButtonText}>Delete Word</Text>
      </TouchableOpacity>
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
