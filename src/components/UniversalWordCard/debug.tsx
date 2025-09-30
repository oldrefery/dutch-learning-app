import React from 'react'
import { View, Text } from 'react-native'
import { UniversalWordCard } from './UniversalWordCard'
import type { AnalysisResult } from '@/components/AddWordScreen/types/AddWordTypes'

// Test data for debugging
const testAnalysisResult: AnalysisResult = {
  dutch_lemma: 'kopen',
  part_of_speech: 'verb',
  is_irregular: true,
  article: undefined,
  is_reflexive: false,
  is_expression: false,
  is_separable: false,
  prefix_part: undefined,
  root_verb: undefined,
  translations: {
    en: ['to buy', 'to purchase'],
    ru: ['покупать', 'приобретать'],
  },
  examples: [
    {
      nl: 'Ik koop een boek',
      en: 'I buy a book',
      ru: 'Я покупаю книгу',
    },
  ],
  tts_url: 'https://example.com/audio',
  image_url: 'https://example.com/image.jpg',
}

export function DebugWordCard() {
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>
        Debug UniversalWordCard:
      </Text>
      <UniversalWordCard
        word={testAnalysisResult}
        actions={{
          showDuplicateCheck: true,
          isDuplicateChecking: false,
          isAlreadyInCollection: false,
        }}
      />
    </View>
  )
}
