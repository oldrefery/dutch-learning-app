import {
  readWordVariantChoices,
  type WordVariant,
} from '../../../packages/domain/src/word-variant.ts'
import { callGeminiAPI, parseGeminiResponse } from './geminiUtils.ts'

const candidateSchema = {
  type: 'object',
  required: ['choices'],
  properties: {
    choices: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['lemma', 'partOfSpeech', 'article', 'translations'],
        properties: {
          lemma: { type: 'string' },
          partOfSpeech: { type: 'string' },
          article: { type: 'string', enum: ['', 'de', 'het'] },
          translations: {
            type: 'object',
            required: ['en', 'ru'],
            properties: { en: { type: 'string' }, ru: { type: 'string' } },
          },
        },
      },
    },
  },
}

export async function discoverWordVariants(word: string) {
  const prompt = `List distinct modern Dutch dictionary entries that the supplied word can genuinely represent, ordered with the most common first. Include relevant adjectival and verbal uses of participles and the infinitive for verbal uses. Include both noun articles only when both are attested, explaining any usage difference in the short glosses. Do not list multiple glosses for the same lemma, part of speech and article. Use lowercase English part-of-speech names (e.g. verb, adjective, noun, adverb), bare Dutch lemmas, and empty article for non-nouns. Provide one short translation in English and one in Russian Cyrillic for each choice. Return no choices for a likely typo so the regular analysis can correct it.
Input: ${JSON.stringify(word)}`
  const response = await callGeminiAPI(prompt, false, candidateSchema)
  const { choices } = parseGeminiResponse(response)
  if (!Array.isArray(choices)) {
    throw new Error('Could not find word variants. Please try again.')
  }
  const valid = readWordVariantChoices(choices).filter(choice =>
    /\p{Script=Cyrillic}/u.test(choice.translations.ru)
  )
  if (choices.length && !valid.length) {
    throw new Error('Could not verify word variants. Please try again.')
  }
  return valid
}

export function wordVariantInstruction(requested: Partial<WordVariant>) {
  if (!requested.partOfSpeech && !requested.article && !requested.lemma)
    return ''
  return `\nThe learner explicitly selected this dictionary variant: ${JSON.stringify(requested)}. Its constraints override the default instruction to choose the most common usage. Use the specified part of speech and article, and the specified canonical lemma if present. All translations, examples and grammar must describe this variant. When a verb is requested for an inflected form, use the infinitive. When an adjectival use is requested, analyze the adjective.\n`
}
