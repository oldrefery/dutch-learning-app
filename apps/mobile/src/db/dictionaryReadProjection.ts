import { parseDictionaryReadContent } from '@woordenaar/domain'
import type { Word, WordExample, WordUsageContrast } from '@/types/database'
import { isValidExpressionType } from '@/types/ExpressionTypes'

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const example = (value: unknown): WordExample | null => {
  if (
    !record(value) ||
    typeof value.nl !== 'string' ||
    typeof value.en !== 'string'
  )
    return null
  return {
    nl: value.nl,
    en: value.en,
    ru: typeof value.ru === 'string' ? value.ru : undefined,
  }
}
const conjugation = (value: unknown): Word['conjugation'] => {
  if (
    !record(value) ||
    typeof value.present !== 'string' ||
    typeof value.simple_past !== 'string' ||
    typeof value.past_participle !== 'string'
  )
    return null
  return {
    present: value.present,
    simple_past: value.simple_past,
    simple_past_plural:
      typeof value.simple_past_plural === 'string'
        ? value.simple_past_plural
        : undefined,
    past_participle: value.past_participle,
  }
}
const contrast = (value: unknown): WordUsageContrast | null => {
  if (
    !record(value) ||
    typeof value.term !== 'string' ||
    typeof value.distinction !== 'string'
  )
    return null
  return {
    term: value.term,
    distinction: value.distinction,
    example: example(value.example) ?? undefined,
  }
}
const usageNotes = (value: unknown): Word['usage_notes'] => {
  if (
    !record(value) ||
    typeof value.summary !== 'string' ||
    !Array.isArray(value.contrasts)
  )
    return null
  return {
    summary: value.summary,
    contrasts: value.contrasts
      .map(contrast)
      .filter((item): item is WordUsageContrast => item !== null),
  }
}

/** Display projection only. Raw legacy JSON stays in its cache/original/command;
 * normalized display values must never become an import or publication authority. */
export const projectDictionaryReadWord = (
  word: Word,
  value: unknown,
  metadata?: Pick<
    Word,
    | 'cefr_level'
    | 'cefr_status'
    | 'cefr_confidence'
    | 'dictionary_content_source'
    | 'dictionary_content_conflict'
    | 'dictionary_content_state'
  >
): Word => {
  const parsed = parseDictionaryReadContent(value)
  if (!parsed.success)
    throw new Error('Invalid cached dictionary display content')
  const content = parsed.data
  const translations = record(content.translations) ? content.translations : {}
  return {
    ...word,
    dutch_lemma: content.dutch_lemma,
    dutch_original: content.dutch_original,
    part_of_speech: content.part_of_speech,
    article:
      content.article === 'de' || content.article === 'het'
        ? content.article
        : null,
    translations: {
      en: strings(translations.en),
      ru: strings(translations.ru),
    },
    examples: (content.examples ?? [])
      .map(example)
      .filter((item): item is WordExample => item !== null),
    is_irregular: content.is_irregular ?? false,
    is_reflexive: content.is_reflexive ?? false,
    is_expression: content.is_expression ?? false,
    expression_type:
      content.expression_type === null
        ? null
        : isValidExpressionType(content.expression_type)
          ? content.expression_type
          : word.expression_type,
    is_separable: content.is_separable ?? false,
    prefix_part: content.prefix_part,
    root_verb: content.root_verb,
    plural: content.plural,
    register:
      content.register === 'neutral' ||
      content.register === 'formal' ||
      content.register === 'informal'
        ? content.register
        : null,
    synonyms: [...(content.synonyms ?? [])],
    antonyms: [...(content.antonyms ?? [])],
    conjugation: conjugation(content.conjugation),
    preposition: content.preposition,
    analysis_notes: content.analysis_notes,
    usage_notes: usageNotes(content.usage_notes),
    image_url: content.image_url,
    tts_url: content.tts_url,
    ...metadata,
  }
}
