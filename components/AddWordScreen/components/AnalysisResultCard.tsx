import React from 'react'
import { ScrollView, TouchableOpacity, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { AnalysisResultCardProps } from '../types/AddWordTypes'
import { analysisResultStyles } from '../styles/AnalysisResultCard.styles'

export function AnalysisResultCard({
  analysisResult,
  isPlayingAudio,
  onPlayPronunciation,
  onImageChange,
  onShowImageSelector,
  isAlreadyInCollection = false,
  isCheckingDuplicate = false,
}: AnalysisResultCardProps) {
  return (
    <ScrollView style={analysisResultStyles.resultContainer}>
      <View style={analysisResultStyles.resultCard}>
        <View style={analysisResultStyles.titleContainer}>
          <Text style={analysisResultStyles.resultTitle}>Analysis Result</Text>
          {isCheckingDuplicate && (
            <View style={analysisResultStyles.checkingBadge}>
              <Ionicons
                name="hourglass"
                size={16}
                color={Colors.neutral[500]}
              />
              <Text style={analysisResultStyles.checkingText}>Checking...</Text>
            </View>
          )}
          {isAlreadyInCollection && !isCheckingDuplicate && (
            <View style={analysisResultStyles.alreadyExistsBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Colors.success.DEFAULT}
              />
              <Text style={analysisResultStyles.alreadyExistsText}>
                Already in collection
              </Text>
            </View>
          )}
        </View>

        <View style={analysisResultStyles.resultRow}>
          <Text style={analysisResultStyles.resultLabel}>Word:</Text>
          <View style={analysisResultStyles.wordWithPronunciation}>
            <Text style={analysisResultStyles.resultValue}>
              {analysisResult.dutch_lemma}
            </Text>
            {analysisResult.tts_url && (
              <TouchableOpacity
                style={analysisResultStyles.pronunciationButton}
                onPress={() => onPlayPronunciation(analysisResult.tts_url!)}
                disabled={isPlayingAudio}
              >
                <Ionicons
                  name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
                  size={20}
                  color={Colors.primary.DEFAULT}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={analysisResultStyles.resultRow}>
          <Text style={analysisResultStyles.resultLabel}>Type:</Text>
          <Text style={analysisResultStyles.resultValue}>
            {analysisResult.part_of_speech}
            {analysisResult.is_irregular ? ' (irregular)' : ''}
            {analysisResult.article ? ` (${analysisResult.article})` : ''}
            {analysisResult.is_reflexive ? ' (reflexive)' : ''}
            {analysisResult.is_expression
              ? ` (${analysisResult.expression_type || 'expression'})`
              : ''}
            {analysisResult.is_separable ? ' (separable)' : ''}
          </Text>
        </View>

        {analysisResult.is_separable &&
          analysisResult.prefix_part &&
          analysisResult.root_verb && (
            <View style={analysisResultStyles.resultRow}>
              <Text style={analysisResultStyles.resultLabel}>Parts:</Text>
              <Text style={analysisResultStyles.resultValue}>
                <Text style={analysisResultStyles.prefixText}>
                  {analysisResult.prefix_part}
                </Text>{' '}
                + {analysisResult.root_verb}
              </Text>
            </View>
          )}

        <View style={analysisResultStyles.resultSection}>
          <Text style={analysisResultStyles.resultLabel}>English:</Text>
          {analysisResult.translations.en.map((translation, index) => (
            <Text key={index} style={analysisResultStyles.translationText}>
              • {translation}
            </Text>
          ))}
        </View>

        {analysisResult.translations.ru && (
          <View style={analysisResultStyles.resultSection}>
            <Text style={analysisResultStyles.resultLabel}>Russian:</Text>
            {analysisResult.translations.ru.map((translation, index) => (
              <Text key={index} style={analysisResultStyles.translationText}>
                • {translation}
              </Text>
            ))}
          </View>
        )}

        {analysisResult.image_url && (
          <View style={analysisResultStyles.resultSection}>
            <Text style={analysisResultStyles.resultLabel}>Visual:</Text>
            <View style={analysisResultStyles.imageContainer}>
              <Image
                source={{ uri: analysisResult.image_url }}
                style={analysisResultStyles.associationImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={analysisResultStyles.changeImageButton}
                onPress={onShowImageSelector}
              >
                <Ionicons name="images" size={16} color="#3b82f6" />
                <Text style={analysisResultStyles.changeImageText}>
                  Change Image
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {analysisResult.examples && analysisResult.examples.length > 0 && (
          <View style={analysisResultStyles.resultSection}>
            <Text style={analysisResultStyles.resultLabel}>Examples:</Text>
            {analysisResult.examples.map((example, index) => (
              <View key={index} style={analysisResultStyles.exampleCard}>
                <Text style={analysisResultStyles.exampleDutch}>
                  {example.nl}
                </Text>
                <Text style={analysisResultStyles.exampleTranslation}>
                  {example.en}
                </Text>
                {example.ru && (
                  <Text style={analysisResultStyles.exampleTranslation}>
                    {example.ru}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
