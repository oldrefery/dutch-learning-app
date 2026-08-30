import type { Database, Json } from '@woordenaar/supabase-contracts'

export type WordRow = Database['public']['Tables']['words']['Row']

export interface WordTranslationSet {
  en: string[]
  ru: string[]
}

export interface WordExample {
  en: string
  nl: string
  ru: string | null
}

export interface WordConjugation {
  pastParticiple: string | null
  present: string | null
  simplePast: string | null
  simplePastPlural: string | null
}

export interface WordUsageContrast {
  distinction: string
  example: WordExample | null
  term: string
}

export interface WordUsageNotes {
  contrasts: WordUsageContrast[]
  summary: string
}

export interface WordDetail {
  analysisNotes: string | null
  antonyms: string[]
  article: string | null
  collectionId: string | null
  conjugation: WordConjugation | null
  createdAt: string
  dutchLemma: string
  dutchOriginal: string | null
  easinessFactor: number
  examples: WordExample[]
  expressionType: string | null
  id: string
  imageUrl: string | null
  intervalDays: number
  isExpression: boolean
  isIrregular: boolean
  isReflexive: boolean
  isSeparable: boolean
  lastReviewedAt: string | null
  nextReviewDate: string
  partOfSpeech: string | null
  plural: string | null
  prefixPart: string | null
  preposition: string | null
  register: string | null
  repetitionCount: number
  rootVerb: string | null
  synonyms: string[]
  translations: WordTranslationSet
  ttsUrl: string | null
  updatedAt: string | null
  usageNotes: WordUsageNotes | null
}

const isJsonRecord = (
  value: Json
): value is { [key: string]: Json | undefined } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toTrimmedString = (value: Json | undefined) =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const toStringArray = (value: Json | undefined) =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const normalized = toTrimmedString(item)
        return normalized ? [normalized] : []
      })
    : []

const parseExample = (value: Json | undefined): WordExample | null => {
  if (!value || !isJsonRecord(value)) return null

  const nl = toTrimmedString(value.nl)
  const en = toTrimmedString(value.en)
  if (!nl || !en) return null

  return {
    nl,
    en,
    ru: toTrimmedString(value.ru),
  }
}

const parseTranslations = (value: Json): WordTranslationSet => {
  if (!isJsonRecord(value)) return { en: [], ru: [] }

  return {
    en: toStringArray(value.en),
    ru: toStringArray(value.ru),
  }
}

const parseConjugation = (value: Json | null): WordConjugation | null => {
  if (!value || !isJsonRecord(value)) return null

  const conjugation = {
    present: toTrimmedString(value.present),
    simplePast: toTrimmedString(value.simple_past),
    simplePastPlural: toTrimmedString(value.simple_past_plural),
    pastParticiple: toTrimmedString(value.past_participle),
  }

  return Object.values(conjugation).some(Boolean) ? conjugation : null
}

const parseUsageNotes = (value: Json | null): WordUsageNotes | null => {
  if (!value || !isJsonRecord(value)) return null

  const summary = toTrimmedString(value.summary) ?? ''
  const contrasts = Array.isArray(value.contrasts)
    ? value.contrasts.flatMap(contrast => {
        if (!contrast || !isJsonRecord(contrast)) return []

        const term = toTrimmedString(contrast.term)
        const distinction = toTrimmedString(contrast.distinction)
        if (!term || !distinction) return []

        return [
          {
            term,
            distinction,
            example: parseExample(contrast.example),
          },
        ]
      })
    : []

  return summary || contrasts.length > 0 ? { summary, contrasts } : null
}

const toHttpsUrl = (value: string | null) => {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export const canRenderWordImage = (imageUrl: string) => {
  try {
    const { hostname, protocol } = new URL(imageUrl)
    return (
      protocol === 'https:' &&
      (hostname === 'images.unsplash.com' || hostname === 'picsum.photos')
    )
  } catch {
    return false
  }
}

export const buildWordDetail = (row: WordRow): WordDetail => ({
  id: row.word_id,
  collectionId: row.collection_id,
  dutchLemma: row.dutch_lemma,
  dutchOriginal: row.dutch_original,
  partOfSpeech: row.part_of_speech,
  article: row.article,
  plural: row.plural,
  register: row.register,
  preposition: row.preposition,
  isIrregular: row.is_irregular ?? false,
  isReflexive: row.is_reflexive ?? false,
  isExpression: row.is_expression ?? false,
  expressionType: row.expression_type,
  isSeparable: row.is_separable ?? false,
  prefixPart: row.prefix_part,
  rootVerb: row.root_verb,
  translations: parseTranslations(row.translations),
  examples: (row.examples ?? []).flatMap(example => {
    const normalized = parseExample(example)
    return normalized ? [normalized] : []
  }),
  synonyms: row.synonyms.map(value => value.trim()).filter(Boolean),
  antonyms: row.antonyms.map(value => value.trim()).filter(Boolean),
  conjugation: parseConjugation(row.conjugation),
  usageNotes: parseUsageNotes(row.usage_notes),
  analysisNotes: row.analysis_notes,
  imageUrl: toHttpsUrl(row.image_url),
  ttsUrl: toHttpsUrl(row.tts_url),
  intervalDays: row.interval_days,
  repetitionCount: row.repetition_count,
  easinessFactor: row.easiness_factor,
  nextReviewDate: row.next_review_date,
  lastReviewedAt: row.last_reviewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
