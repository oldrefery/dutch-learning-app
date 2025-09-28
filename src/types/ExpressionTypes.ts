/**
 * Types of expressions in Dutch language
 * Used to categorize multi-word units and special linguistic constructions
 */
export enum ExpressionType {
  // Multi-word expressions
  IDIOM = 'idiom', // Idiomatic expressions: "de kat uit de boom kijken"
  PHRASE = 'phrase', // General phrases: "op losse schroeven staan"
  COLLOCATION = 'collocation', // Word collocations: "zware regen", "beslissing nemen"
  COMPOUND = 'compound', // Compound words: "voetganger", "belastingdienst"

  // Fixed expressions and sayings
  PROVERB = 'proverb', // Proverbs: "De appel valt niet ver van de boom"
  SAYING = 'saying', // Sayings: "Beter een vogel in de hand dan tien in de lucht"
  FIXED_EXPRESSION = 'fixed_expression', // Fixed expressions: "met andere woorden", "in ieder geval"

  // Special linguistic categories
  INTERJECTION = 'interjection', // Interjections: "Jeetje!", "Verdorie!"
  ABBREVIATION = 'abbreviation', // Abbreviations: "btw", "KLM", "NS"

  // Future extensions (commented out until needed)
  // TECHNICAL_TERM = 'technical_term',
  // SLANG = 'slang',
  // REGIONAL = 'regional',
}

/**
 * Array of all expression types for validation and iteration
 */
export const EXPRESSION_TYPES = Object.values(ExpressionType) as string[]

/**
 * Human-readable labels for expression types
 */
export const EXPRESSION_TYPE_LABELS: Record<ExpressionType, string> = {
  [ExpressionType.IDIOM]: 'Idiom',
  [ExpressionType.PHRASE]: 'Phrase',
  [ExpressionType.COLLOCATION]: 'Collocation',
  [ExpressionType.COMPOUND]: 'Compound',
  [ExpressionType.PROVERB]: 'Proverb',
  [ExpressionType.SAYING]: 'Saying',
  [ExpressionType.FIXED_EXPRESSION]: 'Fixed Expression',
  [ExpressionType.INTERJECTION]: 'Interjection',
  [ExpressionType.ABBREVIATION]: 'Abbreviation',
}

/**
 * Type guard to check if a string is a valid ExpressionType
 */
export function isValidExpressionType(value: string): value is ExpressionType {
  return EXPRESSION_TYPES.includes(value)
}

/**
 * Helper to get expression type label
 */
export function getExpressionTypeLabel(type: ExpressionType): string {
  return EXPRESSION_TYPE_LABELS[type]
}
