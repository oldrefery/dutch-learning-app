import officialDutchA1Pack from '@woordenaar/content'
import { getSemanticWordKey } from '@woordenaar/domain'
import type { Json } from '@woordenaar/supabase-contracts'

const MIN_OFFICIAL_ENTRIES = 50
const MAX_OFFICIAL_ENTRIES = 100

export const NEW_STARTER_PACK_COLLECTION_ID = '__new_starter_pack_collection__'

type UnknownRecord = Record<string, unknown>

export interface StarterPackExample {
  en: string
  nl: string
  ru: string | null
}

export interface StarterPackEntry {
  analysisNotes: string | null
  antonyms: string[]
  article: 'de' | 'het' | null
  conjugation: Json | null
  dutchLemma: string
  dutchOriginal: string
  entryId: string
  examples: StarterPackExample[]
  expressionType: string | null
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
}

export interface StarterPackManifest {
  description: string
  entries: StarterPackEntry[]
  packId: string
  reviewedAt: string
  title: string
  version: string
}

export interface ExistingStarterPackWord {
  article: string | null
  collectionName: string | null
  dutchLemma: string
  partOfSpeech: string | null
}

export interface StarterPackPreviewEntry {
  duplicateCollectionName: string | null
  entry: StarterPackEntry
  isDuplicate: boolean
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Starter pack field ${field} is invalid.`)
  }

  return value.trim()
}

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const text = optionalText(item)
        return text ? [text] : []
      })
    : []

const parseExamples = (value: unknown): StarterPackExample[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        if (!isRecord(item)) return []
        const nl = optionalText(item.nl)
        const en = optionalText(item.en)
        return nl && en ? [{ nl, en, ru: optionalText(item.ru) }] : []
      })
    : []

const parseJsonObject = (value: unknown): Json | null =>
  isRecord(value) ? (value as Json) : null

const parseEntry = (value: unknown, index: number): StarterPackEntry => {
  if (!isRecord(value)) {
    throw new Error(`Starter pack entry ${index + 1} is invalid.`)
  }

  if (!isRecord(value.translations)) {
    throw new Error(`Starter pack entry ${index + 1} has no translations.`)
  }

  const englishTranslations = stringArray(value.translations.en)
  if (englishTranslations.length === 0) {
    throw new Error(
      `Starter pack entry ${index + 1} has no English translation.`
    )
  }

  const article =
    value.article === 'de' || value.article === 'het' ? value.article : null
  const register =
    value.register === 'formal' ||
    value.register === 'informal' ||
    value.register === 'neutral'
      ? value.register
      : null
  const dutchLemma = requiredText(
    value.dutch_lemma,
    `entries[${index}].dutch_lemma`
  )

  return {
    entryId: requiredText(value.entry_id, `entries[${index}].entry_id`),
    dutchLemma,
    dutchOriginal: optionalText(value.dutch_original) ?? dutchLemma,
    partOfSpeech: requiredText(
      value.part_of_speech,
      `entries[${index}].part_of_speech`
    ),
    isIrregular: value.is_irregular === true,
    isReflexive: value.is_reflexive === true,
    isExpression: value.is_expression === true,
    expressionType: optionalText(value.expression_type),
    isSeparable: value.is_separable === true,
    prefixPart: optionalText(value.prefix_part),
    rootVerb: optionalText(value.root_verb),
    article,
    plural: optionalText(value.plural),
    register,
    translations: {
      en: englishTranslations,
      ru: stringArray(value.translations.ru),
    },
    examples: parseExamples(value.examples),
    synonyms: stringArray(value.synonyms),
    antonyms: stringArray(value.antonyms),
    conjugation: parseJsonObject(value.conjugation),
    preposition: optionalText(value.preposition),
    analysisNotes: optionalText(value.analysis_notes),
  }
}

export const loadOfficialStarterPack = (): StarterPackManifest => {
  const value: unknown = officialDutchA1Pack
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    throw new Error('The official starter pack is invalid.')
  }
  if (value.schema_version !== 1) {
    throw new Error('The official starter pack schema is not supported.')
  }
  if (
    value.entries.length < MIN_OFFICIAL_ENTRIES ||
    value.entries.length > MAX_OFFICIAL_ENTRIES
  ) {
    throw new Error('The official starter pack has an invalid size.')
  }
  if (
    !isRecord(value.content_review) ||
    value.content_review.status !== 'approved'
  ) {
    throw new Error('The official starter pack is awaiting content review.')
  }

  const entries = value.entries.map(parseEntry)
  const entryIds = new Set(entries.map(entry => entry.entryId))
  if (entryIds.size !== entries.length) {
    throw new Error('The official starter pack contains duplicate entry IDs.')
  }

  return {
    packId: requiredText(value.pack_id, 'pack_id'),
    version: requiredText(value.version, 'version'),
    title: requiredText(value.title, 'title'),
    description: requiredText(value.description, 'description'),
    reviewedAt: requiredText(value.content_review.reviewed_at, 'reviewed_at'),
    entries,
  }
}

export const getStarterPackSemanticKey = (
  dutchLemma: string,
  partOfSpeech: string | null,
  article: string | null
): string => getSemanticWordKey(dutchLemma, partOfSpeech, article)

export const buildStarterPackPreview = (
  manifest: StarterPackManifest,
  existingWords: ExistingStarterPackWord[]
): StarterPackPreviewEntry[] => {
  const existingByKey = new Map<string, string | null>()
  existingWords.forEach(word => {
    const key = getStarterPackSemanticKey(
      word.dutchLemma,
      word.partOfSpeech,
      word.article
    )
    if (!existingByKey.has(key)) {
      existingByKey.set(key, word.collectionName)
    }
  })

  return manifest.entries.map(entry => {
    const key = getStarterPackSemanticKey(
      entry.dutchLemma,
      entry.partOfSpeech,
      entry.article
    )
    const isDuplicate = existingByKey.has(key)
    return {
      entry,
      isDuplicate,
      duplicateCollectionName: isDuplicate
        ? (existingByKey.get(key) ?? null)
        : null,
    }
  })
}

export const selectStarterPackEntries = (
  manifest: StarterPackManifest,
  entryIds: string[]
): StarterPackEntry[] => {
  const selectedIds = new Set(entryIds)
  return manifest.entries.filter(entry => selectedIds.has(entry.entryId))
}

const toExampleJson = (example: StarterPackExample): Json => ({
  nl: example.nl,
  en: example.en,
  ru: example.ru,
})

export const buildStarterPackImportPayload = (
  entries: StarterPackEntry[]
): Json[] =>
  entries.map(entry => ({
    dutch_lemma: entry.dutchLemma,
    dutch_original: entry.dutchOriginal,
    part_of_speech: entry.partOfSpeech,
    is_irregular: entry.isIrregular,
    is_reflexive: entry.isReflexive,
    is_expression: entry.isExpression,
    expression_type: entry.expressionType,
    is_separable: entry.isSeparable,
    prefix_part: entry.prefixPart,
    root_verb: entry.rootVerb,
    article: entry.article,
    plural: entry.plural,
    register: entry.register,
    translations: entry.translations,
    examples: entry.examples.map(toExampleJson),
    synonyms: entry.synonyms,
    antonyms: entry.antonyms,
    conjugation: entry.conjugation,
    preposition: entry.preposition,
    image_url: null,
    tts_url: '',
    analysis_notes: entry.analysisNotes,
    usage_notes: null,
  }))
