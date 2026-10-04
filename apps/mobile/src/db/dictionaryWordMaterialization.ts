import type { LocalDictionaryMaterialization } from './dictionaryContentRepository'
import type { Word } from '@/types/database'
import { isValidExpressionType } from '@/types/ExpressionTypes'

const toExpressionType = (
  value: string | null,
  fallback: Word['expression_type']
): Word['expression_type'] => {
  if (value === null) return null
  return isValidExpressionType(value) ? value : fallback
}

export const applyDictionaryMaterialization = (
  word: Word,
  materialization: LocalDictionaryMaterialization | undefined
): Word => {
  if (!materialization) return word
  const content = materialization.effective.content
  const metadata = {
    cefr_level: materialization.cefr.level,
    cefr_status: materialization.cefr.status,
    cefr_confidence: null,
    dictionary_content_source: materialization.effective.source,
    dictionary_content_conflict: materialization.has_conflict ?? false,
  } as const
  if (content === null) return { ...word, ...metadata }

  return {
    ...word,
    ...metadata,
    dutch_lemma: content.dutch_lemma ?? word.dutch_lemma,
    dutch_original: content.dutch_original,
    part_of_speech: content.part_of_speech,
    article: content.article,
    translations: content.translations ?? { en: [], ru: [] },
    examples: (content.examples ?? []).map(example => ({
      nl: example.nl,
      en: example.en,
      ru: example.ru ?? undefined,
    })),
    is_irregular: content.is_irregular ?? false,
    is_reflexive: content.is_reflexive ?? false,
    is_expression: content.is_expression ?? false,
    expression_type: toExpressionType(
      content.expression_type,
      word.expression_type
    ),
    is_separable: content.is_separable ?? false,
    prefix_part: content.prefix_part,
    root_verb: content.root_verb,
    plural: content.plural,
    register: content.register,
    synonyms: content.synonyms ?? [],
    antonyms: content.antonyms ?? [],
    conjugation:
      content.conjugation === null
        ? null
        : {
            present: content.conjugation.present,
            simple_past: content.conjugation.simple_past,
            simple_past_plural:
              content.conjugation.simple_past_plural ?? undefined,
            past_participle: content.conjugation.past_participle,
          },
    preposition: content.preposition,
    analysis_notes: content.analysis_notes,
    usage_notes:
      content.usage_notes === null
        ? null
        : {
            summary: content.usage_notes.summary,
            contrasts: content.usage_notes.contrasts.map(contrast => ({
              term: contrast.term,
              distinction: contrast.distinction,
              example:
                contrast.example === null
                  ? undefined
                  : {
                      nl: contrast.example.nl,
                      en: contrast.example.en,
                      ru: contrast.example.ru ?? undefined,
                    },
            })),
          },
    image_url: content.image_url,
    tts_url: content.tts_url,
  }
}

export const applyDictionaryMaterializations = (
  words: readonly Word[],
  materializations: ReadonlyMap<string, LocalDictionaryMaterialization>
): Word[] =>
  words.map(word =>
    applyDictionaryMaterialization(word, materializations.get(word.word_id))
  )
