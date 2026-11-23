import {
  additionalPreposition,
  phraseAudioUrl,
  type DictionaryContent,
} from '@woordenaar/domain'
import { isValidExpressionType } from '@/types/ExpressionTypes'
import type { AnalysisResult } from './types/AddWordTypes'

export function publishedPhraseAnalysis(
  content: DictionaryContent
): AnalysisResult {
  return {
    dutch_lemma: content.dutch_lemma,
    part_of_speech: content.part_of_speech ?? 'expression',
    article: content.article ?? undefined,
    is_irregular: content.is_irregular,
    is_reflexive: content.is_reflexive,
    is_expression: content.is_expression,
    is_separable: content.is_separable,
    expression_type:
      content.expression_type && isValidExpressionType(content.expression_type)
        ? content.expression_type
        : undefined,
    prefix_part: content.prefix_part ?? undefined,
    root_verb: content.root_verb ?? undefined,
    translations: content.translations,
    examples: content.examples.map(example => ({
      ...example,
      ru: example.ru ?? undefined,
    })),
    tts_url:
      content.tts_url || phraseAudioUrl(content.dutch_lemma) || undefined,
    image_url: content.image_url ?? undefined,
    synonyms: content.synonyms,
    antonyms: content.antonyms,
    plural: content.plural ?? undefined,
    conjugation: content.conjugation && {
      ...content.conjugation,
      simple_past_plural: content.conjugation.simple_past_plural ?? undefined,
    },
    preposition:
      additionalPreposition(content.dutch_lemma, content.preposition) ??
      undefined,
    register: content.register ?? undefined,
    analysis_notes: content.analysis_notes ?? undefined,
    usage_notes: content.usage_notes && {
      summary: content.usage_notes.summary,
      contrasts: content.usage_notes.contrasts.map(c => ({
        ...c,
        example: c.example
          ? { ...c.example, ru: c.example.ru ?? undefined }
          : undefined,
      })),
    },
  }
}
