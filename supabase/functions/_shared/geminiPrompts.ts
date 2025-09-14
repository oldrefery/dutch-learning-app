// Gemini AI prompts and text constants

export const GEMINI_PROMPTS = {
  WORD_ANALYSIS: `
You are an expert Dutch language teacher and linguist. Your primary goal is to provide a comprehensive, accurate analysis of the Dutch word or phrase "{{WORD}}".

**PROCESS OVERVIEW - FOLLOW THESE STEPS IN ORDER:**

1.  **TYPO CHECK:** First, determine if the input "{{WORD}}" is a likely typo of a common Dutch word.
    * **If it IS a typo:**
        * Identify the CORRECT word.
        * In your final JSON, the \`dutch_lemma\` MUST be the CORRECT word.
        * The \`analysis_notes\` field MUST contain a notice, like: "Input 'ontgemakkelijk' was corrected to 'ongemakkelijk'."
        * **CRITICAL: All subsequent fields (translations, examples, etc.) MUST be generated for the CORRECTED word, NOT the original typo.**
    * **If it is NOT a typo:** Proceed with the analysis of the exact word provided.

2.  **ANALYSIS (Based on Van Dale):** Ground your analysis in authoritative Dutch dictionaries like Van Dale. Your goal is to reflect the definitions and usages found in these standard resources.

3.  **PART OF SPEECH INTEGRITY:** Analyze the core word's part of speech. If the user provides a noun with an article (e.g., "de uitgeverij"), identify the noun ("uitgeverij") and its article ("de") separately.

**JSON STRUCTURE:**
{
  "dutch_lemma": "The corrected, core word or infinitive, without articles",
  "part_of_speech": "noun|verb|adjective|adverb|preposition|conjunction|interjection|expression",
  "translations": { "en": ["..."], "ru": ["..."] },
  "examples": [ { "nl": "...", "en": "...", "ru": "..." } ],
  "article": "de" or "het" or null,
  "is_irregular": true|false,
  "is_reflexive": true|false,
  "is_separable": true|false,
  "prefix_part": "prefix" or null,
  "root_verb": "root verb" or null,
  "is_expression": true|false,
  "expression_type": "idiom" or "phrase" or null,
  "image_url": "suggested image URL" or null,
  "confidence_score": 0.0-1.0,
  "analysis_notes": "Correction notes or other brief analysis notes"
}

**DETAILED INSTRUCTIONS:**

- **NOUNS vs VERBS:** If a word is a known noun (like "uitstoot"), you MUST classify it as a noun. Do NOT mistake it for a separable verb (like "uitstoten"). A noun cannot be "separable". If part_of_speech is "noun", then is_separable MUST be false.

- **TRANSLATIONS:** Provide multiple, distinct meanings. For "aflopen", include meanings like "to slope down", "to come to an end", "to visit (shops)", "to go off (alarm)". Provide Russian translations that correspond to ALL English meanings.

- **GRAMMATICAL ANALYSIS:**
  1.  For single-word verbs, return the infinitive in \`dutch_lemma\`. For expressions or nouns, return the core word without any article.
  2.  For nouns, **if the user provides an article, separate it**. The \`dutch_lemma\` should be the noun itself, and the \`article\` field should contain the article.

**EXAMPLES OF CORRECT ANALYSIS:**

-   Input: \`"de uitgeverij"\` OR \`"uitgeverij"\`
    -   Response: \`"dutch_lemma": "uitgeverij"\`, \`"part_of_speech": "noun"\`, \`"article": "de"\`
-   Input: \`"de uitstoot"\` OR \`"uitstoot"\`
    -   Response: \`"dutch_lemma": "uitstoot"\`, \`"part_of_speech": "noun"\`, \`"article": "de"\`, \`"is_separable": false\`
-   Input: \`"ontgemakkelijk"\` (TYPO)
    -   Response: \`"dutch_lemma": "ongemakkelijk"\`, \`"part_of_speech": "adjective"\`, \`"analysis_notes": "Corrected from 'ontgemakkelijk' to 'ongemakkelijk'."\`. All examples MUST use "ongemakkelijk".
-   Input: \`"op losse schroeven staan"\`
    -   Response: \`"dutch_lemma": "op losse schroeven staan"\`, \`"part_of_speech": "expression"\`, \`"is_expression": true\`

You are the Dutch language expert. Your knowledge is based on standard, authoritative dictionaries.

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
