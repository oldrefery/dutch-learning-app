import type { Database, Json } from '@woordenaar/supabase-contracts'
import type { WordAnalysis } from './analysis-contract'

export type WordInsert = Database['public']['Tables']['words']['Insert']
export type WordUpdate = Database['public']['Tables']['words']['Update']

const toExampleJson = (analysis: WordAnalysis): Json[] =>
  analysis.examples.map(example => ({
    nl: example.nl,
    en: example.en,
    ru: example.ru,
  }))

const toConjugationJson = (analysis: WordAnalysis): Json | null =>
  analysis.conjugation
    ? {
        present: analysis.conjugation.present,
        simple_past: analysis.conjugation.simplePast,
        simple_past_plural: analysis.conjugation.simplePastPlural,
        past_participle: analysis.conjugation.pastParticiple,
      }
    : null

const toUsageNotesJson = (analysis: WordAnalysis): Json | null =>
  analysis.usageNotes
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
    : null

export const buildWordAnalysisUpdate = (
  analysis: WordAnalysis
): WordUpdate => ({
  dutch_lemma: analysis.dutchLemma,
  dutch_original: analysis.dutchOriginal,
  part_of_speech: analysis.partOfSpeech,
  is_irregular: analysis.isIrregular,
  is_reflexive: analysis.isReflexive,
  is_expression: analysis.isExpression,
  expression_type: analysis.expressionType,
  is_separable: analysis.isSeparable,
  prefix_part: analysis.prefixPart,
  root_verb: analysis.rootVerb,
  article: analysis.article,
  plural: analysis.plural,
  register: analysis.register,
  translations: analysis.translations,
  examples: toExampleJson(analysis),
  synonyms: analysis.synonyms,
  antonyms: analysis.antonyms,
  conjugation: toConjugationJson(analysis),
  preposition: analysis.preposition,
  image_url: analysis.imageUrl,
  tts_url: analysis.ttsUrl ?? '',
  analysis_notes: analysis.analysisNotes,
  usage_notes: toUsageNotesJson(analysis),
})

export const buildConflictSafeAnalysisUpdate = (
  analysis: WordAnalysis
): WordUpdate => {
  const update = buildWordAnalysisUpdate(analysis)
  delete update.dutch_lemma
  delete update.part_of_speech
  delete update.article
  return update
}

export const buildWordInsert = (
  analysis: WordAnalysis,
  userId: string,
  collectionId: string,
  now: Date = new Date()
): WordInsert => ({
  ...buildWordAnalysisUpdate(analysis),
  dutch_lemma: analysis.dutchLemma,
  translations: analysis.translations,
  tts_url: analysis.ttsUrl ?? '',
  user_id: userId,
  collection_id: collectionId,
  easiness_factor: 2.5,
  interval_days: 1,
  repetition_count: 0,
  next_review_date: now.toISOString().split('T')[0],
  last_reviewed_at: null,
})
