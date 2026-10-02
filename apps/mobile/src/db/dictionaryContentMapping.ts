import type { Word } from '@/types/database'
import {
  parseDictionaryContent,
  type DictionaryContent,
} from '@woordenaar/domain'

const requireContent = (value: unknown): DictionaryContent => {
  const result = parseDictionaryContent(value)
  if (result.success) return result.data
  const firstIssue = result.issues[0]
  throw new Error(
    `Cannot create dictionary fallback${
      firstIssue ? `: ${firstIssue.path} ${firstIssue.message}` : ''
    }`
  )
}

export const wordToDictionaryContent = (word: Word): DictionaryContent =>
  requireContent({
    dutch_lemma: word.dutch_lemma,
    dutch_original: word.dutch_original,
    part_of_speech: word.part_of_speech,
    article: word.article,
    translations: {
      en: word.translations.en,
      ru: word.translations.ru ?? [],
    },
    examples: (word.examples ?? []).map(example => ({
      nl: example.nl,
      en: example.en,
      ru: example.ru ?? null,
    })),
    is_irregular: word.is_irregular,
    is_reflexive: word.is_reflexive,
    is_expression: word.is_expression,
    expression_type: word.expression_type ?? null,
    is_separable: word.is_separable,
    prefix_part: word.prefix_part,
    root_verb: word.root_verb,
    plural: word.plural,
    register: word.register,
    synonyms: word.synonyms,
    antonyms: word.antonyms,
    conjugation:
      word.conjugation === null
        ? null
        : {
            present: word.conjugation.present,
            simple_past: word.conjugation.simple_past,
            simple_past_plural: word.conjugation.simple_past_plural ?? null,
            past_participle: word.conjugation.past_participle,
          },
    preposition: word.preposition,
    analysis_notes: word.analysis_notes?.trim() ? word.analysis_notes : null,
    usage_notes:
      word.usage_notes == null
        ? null
        : {
            summary: word.usage_notes.summary,
            contrasts: word.usage_notes.contrasts.map(contrast => ({
              term: contrast.term,
              distinction: contrast.distinction,
              example:
                contrast.example == null
                  ? null
                  : {
                      nl: contrast.example.nl,
                      en: contrast.example.en,
                      ru: contrast.example.ru ?? null,
                    },
            })),
          },
    image_url: word.image_url,
    tts_url: word.tts_url,
  })
