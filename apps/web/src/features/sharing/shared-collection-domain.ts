import { getSemanticWordKey, PRODUCTION_ORIGIN } from '@woordenaar/domain'
import type { Database, Json } from '@woordenaar/supabase-contracts'

type WordRow = Database['public']['Tables']['words']['Row']

export type SharedCollectionWord = Pick<
  WordRow,
  | 'analysis_notes'
  | 'antonyms'
  | 'article'
  | 'conjugation'
  | 'created_at'
  | 'dutch_lemma'
  | 'dutch_original'
  | 'examples'
  | 'expression_type'
  | 'image_url'
  | 'is_expression'
  | 'is_irregular'
  | 'is_reflexive'
  | 'is_separable'
  | 'part_of_speech'
  | 'plural'
  | 'prefix_part'
  | 'preposition'
  | 'register'
  | 'root_verb'
  | 'synonyms'
  | 'translations'
  | 'tts_url'
  | 'usage_notes'
  | 'word_id'
>

export interface ExistingSharedImportWord {
  article: string | null
  collectionName: string | null
  dutchLemma: string
  partOfSpeech: string | null
}

export interface SharedCollectionPreviewWord {
  article: string | null
  duplicateCollectionName: string | null
  dutchLemma: string
  id: string
  isDuplicate: boolean
  partOfSpeech: string | null
  translation: string
}

const isJsonRecord = (
  value: Json
): value is { [key: string]: Json | undefined } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getFirstEnglishTranslation = (translations: Json): string => {
  if (!isJsonRecord(translations) || !Array.isArray(translations.en)) {
    return 'No English translation'
  }

  const translation = translations.en.find(
    value => typeof value === 'string' && value.trim() !== ''
  )
  return typeof translation === 'string'
    ? translation
    : 'No English translation'
}

export const isSharedResourceId = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )

export const buildSharedCollectionUrl = (shareToken: string): string =>
  `${PRODUCTION_ORIGIN}/share/${shareToken}`

export const buildSharedCollectionPreview = (
  words: SharedCollectionWord[],
  existingWords: ExistingSharedImportWord[]
): SharedCollectionPreviewWord[] => {
  const existingByKey = new Map<string, string | null>()
  existingWords.forEach(word => {
    const key = getSemanticWordKey(
      word.dutchLemma,
      word.partOfSpeech,
      word.article
    )
    if (!existingByKey.has(key)) {
      existingByKey.set(key, word.collectionName)
    }
  })

  return words.map(word => {
    const key = getSemanticWordKey(
      word.dutch_lemma,
      word.part_of_speech,
      word.article
    )
    const isDuplicate = existingByKey.has(key)

    return {
      id: word.word_id,
      dutchLemma: word.dutch_lemma,
      partOfSpeech: word.part_of_speech,
      article: word.article,
      translation: getFirstEnglishTranslation(word.translations),
      isDuplicate,
      duplicateCollectionName: isDuplicate
        ? (existingByKey.get(key) ?? null)
        : null,
    }
  })
}

export const selectSharedCollectionWords = (
  words: SharedCollectionWord[],
  selectedWordIds: string[]
): SharedCollectionWord[] => {
  const selectedIds = new Set(selectedWordIds)
  return words.filter(word => selectedIds.has(word.word_id))
}

export const removeExistingSharedWords = (
  words: SharedCollectionWord[],
  existingWords: ExistingSharedImportWord[]
): SharedCollectionWord[] => {
  const existingKeys = new Set(
    existingWords.map(word =>
      getSemanticWordKey(word.dutchLemma, word.partOfSpeech, word.article)
    )
  )
  return words.filter(
    word =>
      !existingKeys.has(
        getSemanticWordKey(word.dutch_lemma, word.part_of_speech, word.article)
      )
  )
}

export const buildSharedCollectionImportPayload = (
  words: SharedCollectionWord[]
): Json[] =>
  words.map(word => ({
    dutch_lemma: word.dutch_lemma,
    dutch_original: word.dutch_original,
    part_of_speech: word.part_of_speech,
    is_irregular: word.is_irregular,
    is_reflexive: word.is_reflexive,
    is_expression: word.is_expression,
    expression_type: word.expression_type,
    is_separable: word.is_separable,
    prefix_part: word.prefix_part,
    root_verb: word.root_verb,
    article: word.article,
    plural: word.plural,
    register: word.register,
    translations: word.translations,
    examples: word.examples ?? [],
    synonyms: word.synonyms,
    antonyms: word.antonyms,
    conjugation: word.conjugation,
    preposition: word.preposition,
    image_url: word.image_url,
    tts_url: word.tts_url,
    analysis_notes: word.analysis_notes,
    usage_notes: word.usage_notes,
  }))
