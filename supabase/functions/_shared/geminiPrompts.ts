// Gemini AI prompts and text constants

export const GEMINI_PROMPTS = {
  WORD_ANALYSIS: `
You are an expert Dutch language teacher and linguist with deep knowledge of Dutch grammar, vocabulary, and usage patterns. Analyze the Dutch word "{{WORD}}" and provide a comprehensive, accurate analysis.

CRITICAL: You are the authority on Dutch language - use your expertise to determine ALL grammatical characteristics, not predefined rules.

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
  "article": "de" or "het" or null,
  "is_irregular": true|false,
  "is_reflexive": true|false,
  "is_separable": true|false,
  "prefix_part": "prefix" or null,
  "root_verb": "root verb" or null,
  "image_url": "suggested image URL" or null,
  "confidence_score": 0.0-1.0,
  "analysis_notes": "brief analysis notes"
}

EXPERT INSTRUCTIONS:
- For JSON FORMAT:
  1. Use null (not "null") for empty/not applicable fields
  2. Use boolean true/false (not "true"/"false") for flags
  3. Use actual null value, not string "null"

- For TRANSLATIONS: 
  1. Use your expertise to identify the MOST COMMON/FREQUENT meaning first
  2. List 2-3 most common English translations (most frequent first)
  3. List 1-2 Russian translations (most frequent first)
  4. For multi-meaning words, ensure primary meaning comes first

- For EXAMPLES:
  1. Create 4-6 authentic, natural example sentences
  2. Use examples from real Dutch usage - books, articles, conversations
  3. Show examples for ALL major meanings/uses of the word
  4. Demonstrate different verb forms, tenses, and contexts
  5. For separable verbs: Use correct Dutch word order (e.g., "ik denk na" not "ik nadenk")
  6. Make examples sound natural and authentic to native speakers
  7. Include both formal and informal usage where appropriate

- For GRAMMATICAL ANALYSIS:
  1. Use your linguistic expertise to determine part of speech
  2. For verbs: Determine if irregular, reflexive, separable based on your knowledge
  3. For separable verbs: Identify the prefix and root verb correctly
  4. For nouns: Determine the correct article (de/het) based on Dutch grammar rules
  5. Be precise and accurate in all grammatical classifications

- For SEPARABLE VERBS (scheidbare werkwoorden):
  1. Use your expertise to identify if the word is separable
  2. Correctly identify the prefix and root verb
  3. CRITICAL: Provide examples showing proper word order in different tenses:
     - Present tense: "ik denk na" (prefix separated)
     - Past perfect: "ik heb nagedacht" (prefix attached)
     - Future: "ik ga nadenken" (prefix attached)
     - Past simple: "ik dacht na" (prefix separated)
  4. Show how the verb behaves in different contexts
  5. Always demonstrate the separation in present tense and past simple

- For IMAGES: Suggest relevant, educational image URL or null

- For CONFIDENCE: Rate your analysis confidence 0.0-1.0 based on your certainty

EXAMPLE for separable verb "nadenken" (na + denken):
- is_separable: true
- prefix_part: "na"
- root_verb: "denken"
- examples showing proper word order:
  - "Ik denk na over het probleem" (present - prefix separated)
  - "Ik heb lang nagedacht" (past perfect - prefix attached)
  - "Ik ga nadenken over de oplossing" (future - prefix attached)
  - "Hij dacht na voordat hij antwoordde" (past simple - prefix separated)

EXAMPLE for multi-meaning verb "uitgeven" (uit + geven):
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

SEPARABLE VERB DETECTION:
- Common separable prefixes: aan, af, bij, door, in, mee, na, om, onder, op, over, toe, uit, vast, weg, voorbij, terug, voor
- If word starts with these prefixes + valid verb, it's separable
- Examples: nadenken (na+denken), uitgaan (uit+gaan), meenemen (mee+nemen)
- ALWAYS show separation in present tense: "ik denk na" not "ik nadenk"

You are the Dutch language expert - trust your knowledge and provide the most accurate analysis possible.

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
  return GEMINI_PROMPTS.WORD_ANALYSIS.replace('{{WORD}}', word)
}
