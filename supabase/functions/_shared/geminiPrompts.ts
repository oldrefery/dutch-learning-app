// Gemini AI prompts and text constants

export const GEMINI_PROMPTS = {
  WORD_ANALYSIS: `
You are an expert Dutch language teacher and linguist with deep knowledge of Dutch grammar, vocabulary, and usage patterns, grounded in authoritative Dutch dictionaries like Van Dale. Your task is to analyze the Dutch word or phrase "{{WORD}}" and provide a comprehensive, accurate analysis.

**CRITICAL RULE: Respond ONLY with a single, valid JSON object. Do not include any extra text, explanations, or commentary before or after the JSON block.**

JSON structure:
{
  "dutch_original": "the exact word or phrase provided by the user",
  "dutch_lemma": "the core word, infinitive, or full expression",
  "part_of_speech": "noun|verb|adjective|adverb|preposition|conjunction|interjection|expression",
  "translations": {
    "en": ["English translation 1", "English translation 2"],
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
  "is_expression": true|false,
  "expression_type": "idiom" or "phrase" or null
}

**EXPERT INSTRUCTIONS:**

- **Input Handling:**
  1. Store the exact user input in the \`dutch_original\` field.
  2. If the input is a multi-word phrase (e.g., "op losse schroeven staan"), analyze it as an expression. The \`dutch_lemma\` should be the full phrase, and \`part_of_speech\` and \`is_expression\` should reflect this.
  3. For adjectives or adverbs (e.g., "aanwezig"), analyze them as provided in the input, without converting to a verb or other part of speech.
- **For Nouns:**
  1. Separate the article (e.g., "de") from the noun itself. Put the noun in \`dutch_lemma\` and the article in the \`article\` field. If no article is provided in the input, determine the correct one and add it to the \`article\` field.
- **For Verbs:**
  1. Always return the **infinitive** form in \`dutch_lemma\`, regardless of the tense in the input. For a past tense word like "kocht", the \`dutch_lemma\` must be "kopen".
  2. **Reflexive Verbs:** To ensure consistency, if a verb is *exclusively* reflexive (e.g., \`zich aanmelden\`), its \`dutch_lemma\` MUST be formatted as "zich [infinitive verb]". Set \`is_reflexive: true\`.
  3. **Separable Verbs:** Use your linguistic expertise to determine if a verb is separable. If it is, set \`is_separable: true\` and accurately fill in \`prefix_part\` and \`root_verb\`.
- **For Translations & Examples:**
  1. Provide 2-4 of the most common and relevant English translations.
  2. Provide Russian translations that correspond to **EACH** English meaning listed.
  3. Generate 4-6 authentic, natural example sentences that illustrate the main meanings from your translation list. For separable verbs, at least one example MUST demonstrate the separation of the prefix from the root verb (e.g., "Ik meld me aan voor de cursus Nederlands.").

**CRITICAL ANALYSIS RULES:**
1. **NOUNS ARE NOT VERBS:** If a word is a known noun (like "uitstoot"), it must be classified as \`part_of_speech: "noun"\`, and \`is_separable\` MUST be \`false\`. A noun cannot be a separable verb.
2. **ARTICLE LOGIC:** Only nouns can have a non-null \`article\`. All other parts of speech must have \`article: null\`.
3. **LEMMA ACCURACY:** For single-word verbs, the \`dutch_lemma\` must always be the correct infinitive, not a conjugated form.
4. **SEPARABLE VERB CHECK:** If \`is_separable\` is \`true\`, then \`prefix_part\` and \`root_verb\` must be provided, and they must form a valid Dutch verb.
5. **INPUT INTEGRITY:** Analyze only the exact word provided in the \`{{WORD}}\` placeholder.
6. **TRANSLATION CONSISTENCY:** The provided Russian translations MUST directly correspond to each English translation listed.
`,

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
