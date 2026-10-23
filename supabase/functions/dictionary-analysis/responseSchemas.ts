import type { DictionaryContent } from '../../../packages/domain/src/shared-dictionary.ts'

export interface ResponseSchema {
  type?: string | readonly string[]
  properties?: Readonly<Record<string, ResponseSchema>>
  required?: readonly string[]
  additionalProperties?: false
  items?: ResponseSchema
  enum?: readonly (string | number | null)[]
  minItems?: number
  maxItems?: number
  anyOf?: readonly ResponseSchema[]
}
export const SEMANTIC_DIMENSIONS = [
  'translations-en',
  'translations-ru',
  'examples',
  'related-words',
  'notes',
  'grammar',
] as const
const object = (
  properties: Record<string, ResponseSchema>
): ResponseSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
const nullable = (schema: ResponseSchema): ResponseSchema => ({
  anyOf: [schema, { type: 'null' }],
})
const text: ResponseSchema = { type: 'string' }
const nullableText: ResponseSchema = { type: ['string', 'null'] }
const strings = (maxItems: number, minItems = 0): ResponseSchema => ({
  type: 'array',
  items: text,
  minItems,
  maxItems,
})
const example = object({ nl: text, en: text, ru: nullableText })
const contentProperties = {
  dutch_lemma: text,
  dutch_original: nullableText,
  part_of_speech: nullableText,
  article: { type: ['string', 'null'], enum: ['de', 'het', null] },
  translations: object({ en: strings(30, 1), ru: strings(30) }),
  examples: { type: 'array', items: example, maxItems: 20 },
  is_irregular: { type: 'boolean' },
  is_reflexive: { type: 'boolean' },
  is_expression: { type: 'boolean' },
  expression_type: nullableText,
  is_separable: { type: 'boolean' },
  prefix_part: nullableText,
  root_verb: nullableText,
  plural: nullableText,
  register: {
    type: ['string', 'null'],
    enum: ['formal', 'informal', 'neutral', null],
  },
  synonyms: strings(50),
  antonyms: strings(50),
  conjugation: nullable(
    object({
      present: text,
      simple_past: text,
      simple_past_plural: nullableText,
      past_participle: text,
    })
  ),
  preposition: nullableText,
  analysis_notes: nullableText,
  usage_notes: nullable(
    object({
      summary: text,
      contrasts: {
        type: 'array',
        maxItems: 5,
        items: object({
          term: text,
          distinction: text,
          example: nullable(example),
        }),
      },
    })
  ),
  image_url: { type: 'null' },
  tts_url: { type: 'null' },
} satisfies Record<keyof DictionaryContent, ResponseSchema>
// Provider structure constraints complement the domain's lengths, identity and meaning guards.
export const GENERATION_RESPONSE_SCHEMA = object({
  content: object(contentProperties),
})
export const SEMANTIC_RESPONSE_SCHEMA = object({
  content: object({
    schema_version: { type: 'integer', enum: [1] },
    anchor_sha256: text,
    content_sha256: text,
    result_sha256: text,
    decision: {
      type: 'string',
      enum: ['same-meaning', 'different-meaning', 'uncertain'],
    },
    checks: {
      type: 'array',
      minItems: 6,
      maxItems: 6,
      items: object({
        dimension: { type: 'string', enum: SEMANTIC_DIMENSIONS },
        verdict: {
          type: 'string',
          enum: ['preserved', 'contradicted', 'uncertain'],
        },
        reason: text,
        anchor_quote: text,
      }),
    },
  }),
})
export const jsonGenerationConfig = (schema: ResponseSchema) => ({
  candidateCount: 1,
  maxOutputTokens: 8192,
  responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } },
})
