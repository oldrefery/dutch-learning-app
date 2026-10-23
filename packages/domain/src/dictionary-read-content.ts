import type { DictionaryValidationResult } from './shared-dictionary'

export type DictionaryReadJson =
  | null
  | string
  | boolean
  | number
  | DictionaryReadJson[]
  | { [key: string]: DictionaryReadJson | undefined }

const textFields = [
  'dutch_original',
  'part_of_speech',
  'article',
  'expression_type',
  'prefix_part',
  'root_verb',
  'plural',
  'register',
  'preposition',
  'analysis_notes',
  'image_url',
  'tts_url',
] as const
const booleanFields = [
  'is_irregular',
  'is_reflexive',
  'is_expression',
  'is_separable',
] as const
const jsonFields = ['translations', 'conjugation', 'usage_notes'] as const
const arrayFields = ['examples', 'synonyms', 'antonyms'] as const
const fields = [
  'dutch_lemma',
  ...textFields,
  ...booleanFields,
  ...jsonFields,
  ...arrayFields,
] as const

/** Legacy read projections may contain removals and pre-canonical private JSON. */
export type DictionaryReadContent = {
  [Field in (typeof textFields)[number]]: string | null
} & {
  [Field in (typeof booleanFields)[number]]: boolean | null
} & {
  dutch_lemma: string
  translations: DictionaryReadJson
  conjugation: DictionaryReadJson
  usage_notes: DictionaryReadJson
  examples: DictionaryReadJson[] | null
  synonyms: string[] | null
  antonyms: string[] | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isJson = (value: unknown): value is DictionaryReadJson =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (Array.isArray(value)
    ? value.every(isJson)
    : isRecord(value) && Object.values(value).every(isJson))

/** Read-only validation; never use this for revisions, commands or publication. */
export const parseDictionaryReadContent = (
  value: unknown
): DictionaryValidationResult<DictionaryReadContent> => {
  const invalid = (): DictionaryValidationResult<DictionaryReadContent> => ({
    success: false,
    issues: [{ path: 'content', message: 'invalid legacy read projection' }],
  })
  if (
    !isRecord(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every(field => Object.hasOwn(value, field)) ||
    typeof value.dutch_lemma !== 'string' ||
    !value.dutch_lemma.trim()
  )
    return invalid()
  for (const field of textFields) {
    if (value[field] !== null && typeof value[field] !== 'string')
      return invalid()
  }
  for (const field of booleanFields) {
    if (value[field] !== null && typeof value[field] !== 'boolean')
      return invalid()
  }
  for (const field of jsonFields) if (!isJson(value[field])) return invalid()
  for (const field of arrayFields) {
    const values = value[field]
    if (values !== null && (!Array.isArray(values) || !values.every(isJson)))
      return invalid()
    if (
      field !== 'examples' &&
      Array.isArray(values) &&
      !values.every(item => typeof item === 'string')
    )
      return invalid()
  }
  return { success: true, data: value as DictionaryReadContent }
}
