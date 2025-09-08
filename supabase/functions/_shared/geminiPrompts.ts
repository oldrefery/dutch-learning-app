// Gemini AI prompts and text constants

export const GEMINI_PROMPTS = {
  WORD_ANALYSIS: `
Analyze the Dutch word "${word}" and provide a comprehensive JSON response. 

CRITICAL: For words with multiple meanings, always list the MOST COMMON/FREQUENT meaning first in translations, and provide examples for ALL major meanings.

JSON structure:
{
  "dutch_lemma": "exact word provided",
  "part_of_speech": "noun|verb|adjective|adverb|preposition|conjunction|interjection",
  "translations": {
    "en": ["English translation 1", "English translation 2", "English translation 3"],
    "ru": ["Russian translation 1", "Russian translation 2"]
  },
  "examples": [
    {
      "nl": "Dutch example sentence",
      "en": "English translation of example",
      "ru": "Russian translation of example"
    }
  ],
  "article": "de|het|null",
  "is_irregular": true|false,
  "is_reflexive": true|false,
  "is_separable": true|false,
  "prefix_part": "prefix|null",
  "root_verb": "root verb|null",
  "image_url": "suggested image URL|null",
  "confidence_score": 0.0-1.0,
  "analysis_notes": "brief analysis notes"
}

IMPORTANT INSTRUCTIONS:
- For TRANSLATIONS: 
  1. PRIORITIZE the most frequent/common meaning first
  2. List 2-3 most common English translations (most frequent first)
  3. List 1-2 Russian translations (most frequent first)
  4. For multi-meaning words, ensure primary meaning comes first
- For EXAMPLES:
  1. Include 4-6 practical example sentences
  2. MANDATORY: Show examples for ALL major meanings/uses of the word
  3. If word has multiple meanings, provide at least 1-2 examples per meaning
  4. Show different verb forms and tenses
- For ARTICLES: Only for nouns, use "de" or "het", null for other parts of speech
- For VERBS: Check if irregular, reflexive, or separable
- For SEPARABLE VERBS: Extract prefix and root verb
- For IMAGES: Suggest relevant image URL or null
- For CONFIDENCE: Rate your analysis confidence 0.0-1.0

Example for multi-meaning verb "uitgeven" (uit + geven):
TRANSLATIONS (most common first): ["to spend (money)", "to publish", "to issue"]
EXAMPLES covering ALL meanings:
- "Ik geef veel geld uit aan eten" (spending money - MOST COMMON)
- "Hoeveel gaf je uit voor die schoenen?" (spending money)
- "De uitgever geeft dit boek uit" (publishing)
- "Het ministerie geeft nieuwe regels uit" (issuing/releasing)
- "Ik heb al mijn geld uitgegeven" (past perfect - spending)
- "Dit boek werd vorig jaar uitgegeven" (past - publishing)

CRITICAL ANALYSIS RULES:
1. ANALYZE ONLY THE EXACT WORD PROVIDED
2. Check if THIS EXACT WORD begins with a separable prefix
3. IMPORTANT: If the word does NOT start with a prefix, set is_separable=false
4. Do NOT confuse with similar verbs (e.g., "strijken" ≠ "uitstrijken")
5. For separable verbs, ensure the root verb is a valid Dutch verb
6. Provide accurate, practical examples that native speakers would use
7. Focus on the most common meanings and uses

Respond ONLY with valid JSON, no additional text.`,

  ERROR_MESSAGES: {
    INVALID_WORD: 'Invalid word provided',
    ANALYSIS_FAILED: 'Word analysis failed',
    GEMINI_API_ERROR: 'Failed to analyze word with Gemini AI',
    INVALID_RESPONSE: 'Invalid response from Gemini AI',
  },

  VALIDATION_RULES: {
    MIN_LEMMA_LENGTH: 2,
    MAX_LEMMA_LENGTH: 50,
    MIN_EXAMPLES: 4,
    MAX_EXAMPLES: 6,
    MIN_EN_TRANSLATIONS: 2,
    MAX_EN_TRANSLATIONS: 3,
    MIN_RU_TRANSLATIONS: 1,
    MAX_RU_TRANSLATIONS: 2,
  },
} as const

// Helper function to format prompt with word
export function formatWordAnalysisPrompt(word: string): string {
  return GEMINI_PROMPTS.WORD_ANALYSIS.replace('${word}', word)
}
