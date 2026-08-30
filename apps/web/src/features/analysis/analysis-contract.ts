import type { Json } from '@woordenaar/supabase-contracts'

export interface AnalysisExample {
  en: string
  nl: string
  ru: string | null
}

export interface AnalysisConjugation {
  pastParticiple: string | null
  present: string | null
  simplePast: string | null
  simplePastPlural: string | null
}

export interface AnalysisUsageContrast {
  distinction: string
  example: AnalysisExample | null
  term: string
}

export interface AnalysisUsageNotes {
  contrasts: AnalysisUsageContrast[]
  summary: string
}

export interface WordAnalysis {
  analysisNotes: string | null
  antonyms: string[]
  article: 'de' | 'het' | null
  conjugation: AnalysisConjugation | null
  dutchLemma: string
  dutchOriginal: string
  examples: AnalysisExample[]
  expressionType: string | null
  imageUrl: string | null
  isExpression: boolean
  isIrregular: boolean
  isReflexive: boolean
  isSeparable: boolean
  partOfSpeech: string
  plural: string | null
  prefixPart: string | null
  preposition: string | null
  register: 'formal' | 'informal' | 'neutral' | null
  rootVerb: string | null
  synonyms: string[]
  translations: {
    en: string[]
    ru: string[]
  }
  ttsUrl: string | null
  usageNotes: AnalysisUsageNotes | null
}

export interface AnalysisMetadata {
  cacheHit: boolean
  forceRefresh: boolean
  source: 'cache' | 'gemini'
  usageCount: number | null
}

export interface WordAnalysisResult {
  analysis: WordAnalysis
  metadata: AnalysisMetadata
}

export interface WordImageOption {
  alt: string
  url: string
}

export interface InputValidationResult {
  error: string | null
  value: string
}

const MAX_INPUT_LENGTH = 120
const MAX_TEXT_LENGTH = 500
const DUTCH_INPUT_PATTERN =
  /^[a-zA-ZàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s\-'!?.,;:]+$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toText = (value: unknown, maxLength = MAX_TEXT_LENGTH) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

const toStringArray = (value: unknown, limit = 12) =>
  Array.isArray(value)
    ? value
        .flatMap(item => {
          const normalized = toText(item)
          return normalized ? [normalized] : []
        })
        .slice(0, limit)
    : []

const toBoolean = (value: unknown) => value === true

const toHttpsUrl = (value: unknown) => {
  const text = toText(value, 2_000)
  if (!text) return null

  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const parseExample = (value: unknown): AnalysisExample | null => {
  if (!isRecord(value)) return null
  const nl = toText(value.nl, 280)
  const en = toText(value.en, 280)
  if (!nl || !en) return null

  return { nl, en, ru: toText(value.ru, 280) }
}

const parseExamples = (value: unknown) =>
  Array.isArray(value)
    ? value
        .flatMap(item => {
          const example = parseExample(item)
          return example ? [example] : []
        })
        .slice(0, 6)
    : []

const parseConjugation = (value: unknown): AnalysisConjugation | null => {
  if (!isRecord(value)) return null

  const conjugation = {
    present: toText(value.present),
    simplePast: toText(value.simple_past),
    simplePastPlural: toText(value.simple_past_plural),
    pastParticiple: toText(value.past_participle),
  }

  return Object.values(conjugation).some(Boolean) ? conjugation : null
}

const parseUsageNotes = (value: unknown): AnalysisUsageNotes | null => {
  if (!isRecord(value)) return null

  const summary = toText(value.summary, 1_000) ?? ''
  const contrasts = Array.isArray(value.contrasts)
    ? value.contrasts
        .flatMap(item => {
          if (!isRecord(item)) return []
          const term = toText(item.term, 120)
          const distinction = toText(item.distinction, 500)
          if (!term || !distinction) return []

          return [
            {
              term,
              distinction,
              example: parseExample(item.example),
            },
          ]
        })
        .slice(0, 3)
    : []

  return summary || contrasts.length > 0 ? { summary, contrasts } : null
}

const parseTranslations = (value: unknown) => {
  if (!isRecord(value)) return { en: [], ru: [] }
  return {
    en: toStringArray(value.en),
    ru: toStringArray(value.ru),
  }
}

const parseRegister = (value: unknown): WordAnalysis['register'] =>
  value === 'formal' || value === 'informal' || value === 'neutral'
    ? value
    : null

const parseArticle = (value: unknown): WordAnalysis['article'] =>
  value === 'de' || value === 'het' ? value : null

const EXPRESSION_TYPES = new Set([
  'idiom',
  'phrase',
  'collocation',
  'compound',
  'proverb',
  'saying',
  'fixed_expression',
  'interjection',
  'abbreviation',
])

const parseExpressionType = (value: unknown) => {
  const normalized = toText(value, 80)
  return normalized && EXPRESSION_TYPES.has(normalized) ? normalized : null
}

export const normalizeDutchInput = (
  value: FormDataEntryValue | string | null
): InputValidationResult => {
  if (typeof value !== 'string') {
    return { value: '', error: 'Enter a Dutch word or expression.' }
  }

  const normalized = value.trim().replace(/\./g, '').replace(/\s+/g, ' ')
  if (!normalized) {
    return { value: '', error: 'Enter a Dutch word or expression.' }
  }
  if (normalized.length > MAX_INPUT_LENGTH) {
    return {
      value: normalized,
      error: `Use ${MAX_INPUT_LENGTH} characters or fewer.`,
    }
  }
  if (!DUTCH_INPUT_PATTERN.test(normalized)) {
    return {
      value: normalized,
      error: 'Use Dutch letters, spaces, and standard punctuation only.',
    }
  }

  return { value: normalized, error: null }
}

export const parseWordAnalysis = (value: unknown): WordAnalysis => {
  if (!isRecord(value)) throw new Error('The analysis response was invalid.')

  const dutchLemma = toText(value.dutch_lemma, MAX_INPUT_LENGTH)
  const dutchOriginal =
    toText(value.dutch_original, MAX_INPUT_LENGTH) ?? dutchLemma
  const translations = parseTranslations(value.translations)
  if (
    !dutchLemma ||
    !dutchOriginal ||
    !DUTCH_INPUT_PATTERN.test(dutchLemma) ||
    translations.en.length === 0
  ) {
    throw new Error('The analysis response was incomplete.')
  }

  const isSeparable = toBoolean(value.is_separable)

  return {
    dutchLemma: dutchLemma.toLocaleLowerCase('nl-NL'),
    dutchOriginal,
    partOfSpeech:
      toText(value.part_of_speech, 80) ?? (isSeparable ? 'verb' : 'unknown'),
    isIrregular: toBoolean(value.is_irregular),
    article: parseArticle(value.article),
    isReflexive: toBoolean(value.is_reflexive),
    isExpression: toBoolean(value.is_expression),
    expressionType: parseExpressionType(value.expression_type),
    isSeparable,
    prefixPart: toText(value.prefix_part, 120),
    rootVerb: toText(value.root_verb, 120),
    translations,
    examples: parseExamples(value.examples),
    ttsUrl: toHttpsUrl(value.tts_url),
    imageUrl: toHttpsUrl(value.image_url),
    synonyms: toStringArray(value.synonyms),
    antonyms: toStringArray(value.antonyms),
    plural: toText(value.plural, 120),
    conjugation: parseConjugation(value.conjugation),
    preposition: toText(value.preposition, 120),
    register: parseRegister(value.register),
    analysisNotes: toText(value.analysis_notes, 4_000),
    usageNotes: parseUsageNotes(value.usage_notes),
  }
}

export const parseAnalysisFunctionResponse = (
  value: unknown
): WordAnalysisResult => {
  if (!isRecord(value))
    throw new Error('The analysis service returned no data.')
  if (value.success !== true) {
    throw new Error(toText(value.error, 500) ?? 'Could not analyze this word.')
  }

  const metadata = isRecord(value.meta) ? value.meta : {}
  const source = metadata.source === 'cache' ? 'cache' : 'gemini'

  return {
    analysis: parseWordAnalysis(value.data),
    metadata: {
      source,
      cacheHit: metadata.cache_hit === true,
      forceRefresh: metadata.force_refresh === true,
      usageCount:
        typeof metadata.usage_count === 'number' ? metadata.usage_count : null,
    },
  }
}

export const parseImageFunctionResponse = (
  value: unknown
): WordImageOption[] => {
  if (!isRecord(value)) throw new Error('The image service returned no data.')
  if (!Array.isArray(value.images)) {
    throw new Error(toText(value.error, 500) ?? 'Could not load images.')
  }

  return value.images.flatMap(item => {
    if (!isRecord(item)) return []
    const url = toHttpsUrl(item.url)
    const alt = toText(item.alt, 280)
    return url && alt ? [{ url, alt }] : []
  })
}

export const mergeWordImageOptions = (
  current: WordImageOption[],
  incoming: WordImageOption[]
) => {
  const unique = new Map<string, WordImageOption>()
  for (const image of [...current, ...incoming]) {
    unique.set(image.url, image)
  }
  return [...unique.values()]
}

export const parseSerializedWordAnalysis = (
  value: FormDataEntryValue | null
): WordAnalysis => {
  if (typeof value !== 'string') throw new Error('Analysis data is missing.')

  try {
    const parsed: unknown = JSON.parse(value)
    return parseWordAnalysis(parsed)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The analysis')) {
      throw error
    }
    throw new Error('Analysis data is invalid.')
  }
}

export const toAnalysisJson = (analysis: WordAnalysis): Json => ({
  dutch_lemma: analysis.dutchLemma,
  dutch_original: analysis.dutchOriginal,
  part_of_speech: analysis.partOfSpeech,
  is_irregular: analysis.isIrregular,
  article: analysis.article,
  is_reflexive: analysis.isReflexive,
  is_expression: analysis.isExpression,
  expression_type: analysis.expressionType,
  is_separable: analysis.isSeparable,
  prefix_part: analysis.prefixPart,
  root_verb: analysis.rootVerb,
  translations: analysis.translations,
  examples: analysis.examples.map(example => ({
    nl: example.nl,
    en: example.en,
    ru: example.ru,
  })),
  tts_url: analysis.ttsUrl,
  image_url: analysis.imageUrl,
  synonyms: analysis.synonyms,
  antonyms: analysis.antonyms,
  plural: analysis.plural,
  conjugation: analysis.conjugation
    ? {
        present: analysis.conjugation.present,
        simple_past: analysis.conjugation.simplePast,
        simple_past_plural: analysis.conjugation.simplePastPlural,
        past_participle: analysis.conjugation.pastParticiple,
      }
    : null,
  preposition: analysis.preposition,
  register: analysis.register,
  analysis_notes: analysis.analysisNotes,
  usage_notes: analysis.usageNotes
    ? {
        summary: analysis.usageNotes.summary,
        contrasts: analysis.usageNotes.contrasts.map(contrast => ({
          term: contrast.term,
          distinction: contrast.distinction,
          example: contrast.example
            ? {
                nl: contrast.example.nl,
                en: contrast.example.en,
                ru: contrast.example.ru,
              }
            : null,
        })),
      }
    : null,
})

export const serializeWordAnalysis = (analysis: WordAnalysis) =>
  JSON.stringify(toAnalysisJson(analysis))
