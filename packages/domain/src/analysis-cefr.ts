import {
  canonicalizeJson,
  CEFR_LEVELS,
  type CefrLevel,
} from './shared-dictionary'

// This identifies an analysis candidate, never a published dictionary assessment.
export const ANALYSIS_CEFR_INPUT_VERSION = 'word-analysis-cefr-v1' as const

export interface AnalysisCefrEstimate {
  level: CefrLevel | null
  status: 'unknown' | 'estimated'
  source: 'model'
  confidence: number | null
  method: string
  method_version: string
  input_version: typeof ANALYSIS_CEFR_INPUT_VERSION
  input_sha256: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const boundedText = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 120 &&
  value.trim() === value
const confidence = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1

export const parseAnalysisCefrEstimate = (
  value: unknown
): AnalysisCefrEstimate | null => {
  if (
    !isRecord(value) ||
    value.source !== 'model' ||
    value.input_version !== ANALYSIS_CEFR_INPUT_VERSION ||
    !boundedText(value.method) ||
    !boundedText(value.method_version) ||
    typeof value.input_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.input_sha256)
  )
    return null
  const known = CEFR_LEVELS.includes(value.level as CefrLevel)
  if (
    value.status === 'estimated'
      ? !known || !confidence(value.confidence)
      : value.status !== 'unknown' ||
        value.level !== null ||
        value.confidence !== null
  )
    return null
  return {
    level: known ? (value.level as CefrLevel) : null,
    status: value.status === 'estimated' ? 'estimated' : 'unknown',
    source: 'model',
    confidence:
      value.status === 'estimated' ? (value.confidence as number) : null,
    method: value.method,
    method_version: value.method_version,
    input_version: ANALYSIS_CEFR_INPUT_VERSION,
    input_sha256: value.input_sha256,
  }
}

// Input excludes media, cache counters, typed spelling and provider claims.
// It is deliberately a different namespace from dictionary meaning input v1.
export const canonicalizeAnalysisCefrInput = (
  value: unknown
): string | null => {
  if (
    !isRecord(value) ||
    typeof value.dutch_lemma !== 'string' ||
    !value.dutch_lemma.trim() ||
    typeof value.part_of_speech !== 'string' ||
    !value.part_of_speech.trim() ||
    !isRecord(value.translations) ||
    !Array.isArray(value.translations.en) ||
    value.translations.en.length === 0 ||
    !value.translations.en.every(x => typeof x === 'string' && x.trim())
  )
    return null
  try {
    return canonicalizeJson({
      input_version: ANALYSIS_CEFR_INPUT_VERSION,
      content: {
        dutch_lemma: value.dutch_lemma.trim().toLocaleLowerCase('nl-NL'),
        part_of_speech: value.part_of_speech,
        article: value.article ?? null,
        translations: {
          en: value.translations.en,
          ru: value.translations.ru ?? [],
        },
        examples: Array.isArray(value.examples)
          ? value.examples.map(x =>
              isRecord(x) ? { nl: x.nl, en: x.en, ru: x.ru ?? null } : x
            )
          : [],
        register: value.register ?? null,
        is_expression: value.is_expression ?? false,
        expression_type: value.expression_type ?? null,
        is_irregular: value.is_irregular ?? false,
        is_reflexive: value.is_reflexive ?? false,
        is_separable: value.is_separable ?? false,
        prefix_part: value.prefix_part ?? null,
        root_verb: value.root_verb ?? null,
        plural: value.plural ?? null,
        conjugation: value.conjugation ?? null,
        preposition: value.preposition ?? null,
        synonyms: value.synonyms ?? [],
        antonyms: value.antonyms ?? [],
      },
    })
  } catch {
    return null
  }
}
