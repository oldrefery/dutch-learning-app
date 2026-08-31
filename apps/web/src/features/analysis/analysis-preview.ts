import type { WordDetail } from '@/features/words/word-detail'
import type { WordAnalysis } from './analysis-contract'

export const buildAnalysisPreview = (analysis: WordAnalysis): WordDetail => ({
  id: 'analysis-preview',
  collectionId: null,
  dutchLemma: analysis.dutchLemma,
  dutchOriginal: analysis.dutchOriginal,
  partOfSpeech: analysis.partOfSpeech,
  article: analysis.article,
  plural: analysis.plural,
  register: analysis.register,
  preposition: analysis.preposition,
  isIrregular: analysis.isIrregular,
  isReflexive: analysis.isReflexive,
  isExpression: analysis.isExpression,
  expressionType: analysis.expressionType,
  isSeparable: analysis.isSeparable,
  prefixPart: analysis.prefixPart,
  rootVerb: analysis.rootVerb,
  translations: analysis.translations,
  examples: analysis.examples,
  synonyms: analysis.synonyms,
  antonyms: analysis.antonyms,
  conjugation: analysis.conjugation,
  usageNotes: analysis.usageNotes,
  analysisNotes: analysis.analysisNotes,
  imageUrl: analysis.imageUrl,
  ttsUrl: analysis.ttsUrl,
  intervalDays: 1,
  repetitionCount: 0,
  easinessFactor: 2.5,
  nextReviewDate: '',
  lastReviewedAt: null,
  createdAt: '',
  updatedAt: null,
})

export const buildAnalysisFromWordDetail = (
  word: WordDetail
): WordAnalysis => ({
  dutchLemma: word.dutchLemma,
  dutchOriginal: word.dutchOriginal ?? word.dutchLemma,
  partOfSpeech: word.partOfSpeech ?? 'unknown',
  article:
    word.article === 'de' || word.article === 'het' ? word.article : null,
  plural: word.plural,
  register:
    word.register === 'formal' ||
    word.register === 'informal' ||
    word.register === 'neutral'
      ? word.register
      : null,
  preposition: word.preposition,
  isIrregular: word.isIrregular,
  isReflexive: word.isReflexive,
  isExpression: word.isExpression,
  expressionType: word.expressionType,
  isSeparable: word.isSeparable,
  prefixPart: word.prefixPart,
  rootVerb: word.rootVerb,
  translations: word.translations,
  examples: word.examples,
  synonyms: word.synonyms,
  antonyms: word.antonyms,
  conjugation: word.conjugation,
  usageNotes: word.usageNotes,
  analysisNotes: word.analysisNotes,
  imageUrl: word.imageUrl,
  ttsUrl: word.ttsUrl,
})
