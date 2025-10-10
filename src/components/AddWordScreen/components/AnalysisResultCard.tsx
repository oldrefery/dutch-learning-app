import React from 'react'
import { ScrollView, TouchableOpacity, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { SelectableText } from '@/components/SelectableText'
import { Colors } from '@/constants/Colors'
import { CopyButton } from '@/components/CopyButton'
import { GlassCapsuleButton } from '@/components/glass/buttons'
import { formatAnalysisResultForCopying } from '@/utils/wordTextFormatter'
import type { AnalysisResultCardProps } from '../types/AddWordTypes'
import { analysisResultStyles } from '../styles/AnalysisResultCard.styles'

export function AnalysisResultCard({
  analysisResult,
  isPlayingAudio,
  onPlayPronunciation,
  onShowImageSelector,
  isAlreadyInCollection = false,
  isCheckingDuplicate = false,
}: AnalysisResultCardProps) {
  return (
    <ScrollView style={analysisResultStyles.resultContainer}>
      <ViewThemed style={analysisResultStyles.resultCard}>
        <ViewThemed style={analysisResultStyles.titleContainer}>
          <TextThemed style={analysisResultStyles.resultTitle}>
            Analysis Result
          </TextThemed>
          <ViewThemed style={analysisResultStyles.titleActions}>
            <CopyButton text={formatAnalysisResultForCopying(analysisResult)} />
            {isCheckingDuplicate && (
              <ViewThemed style={analysisResultStyles.checkingBadge}>
                <Ionicons
                  name="hourglass"
                  size={16}
                  color={Colors.neutral[500]}
                />
                <TextThemed style={analysisResultStyles.checkingText}>
                  Checking...
                </TextThemed>
              </ViewThemed>
            )}
            {isAlreadyInCollection && !isCheckingDuplicate && (
              <ViewThemed style={analysisResultStyles.alreadyExistsBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={Colors.success.DEFAULT}
                />
                <TextThemed style={analysisResultStyles.alreadyExistsText}>
                  Already in collection
                </TextThemed>
              </ViewThemed>
            )}
          </ViewThemed>
        </ViewThemed>

        <ViewThemed style={analysisResultStyles.resultRow}>
          <TextThemed style={analysisResultStyles.resultLabel}>
            Word:
          </TextThemed>
          <ViewThemed style={analysisResultStyles.wordWithPronunciation}>
            <TextThemed style={analysisResultStyles.resultValue} selectable>
              {analysisResult.dutch_lemma}
            </TextThemed>
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
          </ViewThemed>
        </ViewThemed>

        <ViewThemed style={analysisResultStyles.resultRow}>
          <TextThemed style={analysisResultStyles.resultLabel}>
            Type:
          </TextThemed>
          <TextThemed style={analysisResultStyles.resultValue} selectable>
            {analysisResult.part_of_speech}
            {analysisResult.is_irregular ? ' (irregular)' : ''}
            {analysisResult.article ? ` (${analysisResult.article})` : ''}
            {analysisResult.is_reflexive ? ' (reflexive)' : ''}
            {analysisResult.is_expression
              ? ` (${analysisResult.expression_type || 'expression'})`
              : ''}
            {analysisResult.is_separable ? ' (separable)' : ''}
          </TextThemed>
        </ViewThemed>

        {analysisResult.is_separable &&
          analysisResult.prefix_part &&
          analysisResult.root_verb && (
            <ViewThemed style={analysisResultStyles.resultRow}>
              <TextThemed style={analysisResultStyles.resultLabel}>
                Parts:
              </TextThemed>
              <TextThemed style={analysisResultStyles.resultValue} selectable>
                <TextThemed style={analysisResultStyles.prefixText}>
                  {analysisResult.prefix_part}
                </TextThemed>{' '}
                + {analysisResult.root_verb}
              </TextThemed>
            </ViewThemed>
          )}

        <ViewThemed style={analysisResultStyles.resultSection}>
          <TextThemed style={analysisResultStyles.resultLabel}>
            English:
          </TextThemed>
          {analysisResult.translations.en.map((translation, index) => (
            <SelectableText
              key={index}
              style={analysisResultStyles.translationText}
              copyText={translation}
            >
              • {translation}
            </SelectableText>
          ))}
        </ViewThemed>

        {analysisResult.translations.ru && (
          <ViewThemed style={analysisResultStyles.resultSection}>
            <TextThemed style={analysisResultStyles.resultLabel}>
              Russian:
            </TextThemed>
            {analysisResult.translations.ru.map((translation, index) => (
              <SelectableText
                key={index}
                style={analysisResultStyles.translationText}
                copyText={translation}
              >
                • {translation}
              </SelectableText>
            ))}
          </ViewThemed>
        )}

        {analysisResult.image_url && (
          <ViewThemed style={analysisResultStyles.resultSection}>
            <TextThemed style={analysisResultStyles.resultLabel}>
              Visual:
            </TextThemed>
            <ViewThemed style={analysisResultStyles.imageContainer}>
              <Image
                source={{ uri: analysisResult.image_url }}
                style={analysisResultStyles.associationImage}
                resizeMode="cover"
              />
              <GlassCapsuleButton
                icon="images"
                text="Change Image"
                onPress={onShowImageSelector}
                variant="tinted"
                size="medium"
                accessibilityLabel="Change image"
                accessibilityHint="Opens image selector to choose a new image"
              />
            </ViewThemed>
          </ViewThemed>
        )}

        {analysisResult.examples && analysisResult.examples.length > 0 && (
          <ViewThemed style={analysisResultStyles.resultSection}>
            <TextThemed style={analysisResultStyles.resultLabel}>
              Examples:
            </TextThemed>
            {analysisResult.examples.map((example, index) => (
              <ViewThemed key={index} style={analysisResultStyles.exampleCard}>
                <SelectableText
                  style={analysisResultStyles.exampleDutch}
                  copyText={example.nl}
                >
                  {example.nl}
                </SelectableText>
                <SelectableText
                  style={analysisResultStyles.exampleTranslation}
                  copyText={example.en}
                >
                  {example.en}
                </SelectableText>
                {example.ru && (
                  <SelectableText
                    style={analysisResultStyles.exampleTranslation}
                    copyText={example.ru}
                  >
                    {example.ru}
                  </SelectableText>
                )}
              </ViewThemed>
            ))}
          </ViewThemed>
        )}
      </ViewThemed>
    </ScrollView>
  )
}
