// Gemini AI prompts and text constants

export const GEMINI_PROMPTS = {
  WORD_ANALYSIS: `
You are an expert Dutch language teacher and linguist with deep knowledge of Dutch grammar, vocabulary, and usage patterns. Analyze the Dutch word or phrase "{{WORD}}" and provide a comprehensive, accurate analysis.

**CRITICAL RULE 1: Ground your analysis in authoritative Dutch dictionaries like Van Dale. Your primary goal is to reflect the definitions and usages found in these standard resources.**

**CRITICAL RULE 2: Analyze the core word's part of speech. If the user provides a noun with an article (e.g., "de uitgeverij"), identify the noun ("uitgeverij") and its article ("de") separately.**

JSON structure:
{
  "dutch_lemma": "the core word or infinitive, without articles",
  "part_of_speech": "noun|verb|adjective|adverb|preposition|conjunction|interjection|expression",
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
  "article": "de" or "het" or null (ONLY for nouns, null for other parts of speech),
  "is_irregular": true|false,
  "is_reflexive": true|false,
  "is_separable": true|false,
  "prefix_part": "prefix" or null,
  "root_verb": "root verb" or null,
  "is_expression": true|false,
  "expression_type": "idiom" or "phrase" or null,
  "image_url": "suggested image URL" or null,
  "confidence_score": 0.0-1.0,
  "analysis_notes": "brief analysis notes"
}

**EXPERT INSTRUCTIONS:**

- **USER INPUT IS KING:**
  1.  **Expressions:** If the input is a phrase (e.g., "op losse schroeven staan"), analyze it as an expression. Set \`is_expression\` to \`true\` and \`part_of_speech\` to \`"expression"\`. The \`dutch_lemma\` should be the full expression.
  2.  **Adjectives/Adverbs:** If the input is an adjective ("aanwezig") or adverb ("vermoedelijk"), analyze it as such. Do not convert it to a verb ("aanwezig zijn", "vermoeden").

- **For TRANSLATIONS (Based on Van Dale):**
  1.  Provide multiple, distinct meanings. For "aflopen", include meanings like "to slope down", "to come to an end", "to visit (shops)", "to go off (alarm)".
  2.  List 2-4 most common English translations.
  3.  **Provide Russian translations that correspond to ALL English meanings provided.**

- **For EXAMPLES:**
  1.  Create 4-6 authentic, natural example sentences that cover the main meanings.
  2.  For VERBS: Demonstrate different conjugations and tenses.

- **For GRAMMATICAL ANALYSIS:**
  1.  For single-word verbs, return the infinitive in \`dutch_lemma\`.
  2.  For nouns, **if the user provides an article, separate it**. The \`dutch_lemma\` should be the noun itself, and the \`article\` field should contain the article.
  3.  For nouns provided without an article, determine the correct article.

**EXAMPLES OF CORRECT ANALYSIS:**

-   Input: \`"de uitgeverij"\` OR \`"uitgeverij"\`
    -   \`"dutch_lemma": "uitgeverij"\`, \`"part_of_speech": "noun"\`, \`"article": "de"\`
-   Input: \`"Aanwezig"\`
    -   \`"dutch_lemma": "aanwezig"\`, \`"part_of_speech": "adjective"\`, \`"translations": { "en": ["present", "in attendance", "available"], "ru": ["присутствующий", "в наличии"] }\`
-   Input: \`"op losse schroeven staan"\`
    -   \`"dutch_lemma": "op losse schroeven staan"\`, \`"part_of_speech": "expression"\`, \`"is_expression": true\`
-   Input: \`"vermoedelijk"\`
    -   \`"dutch_lemma": "vermoedelijk"\`, \`"part_of_speech": "adverb"\`

CRITICAL ANALYSIS RULES:
1. **NOUNS ARE NOT VERBS:** If a word is a known noun (like "uitstoot"), you MUST classify it as a noun. Do NOT mistake it for a separable verb (like "uitstoten") even if the spelling is similar. A noun cannot be "separable". If part_of_speech is "noun", then is_separable MUST be false.
2. ANALYZE ONLY THE EXACT WORD PROVIDED.
3. Check if THIS EXACT WORD begins with a separable prefix.
4. IMPORTANT: If the word does NOT start with a prefix, set is_separable=false.
5. Do NOT confuse with similar verbs (e.g., "strijken" ≠ "uitstrijken").
6. For separable verbs, ensure the root verb is a valid Dutch verb.
7. Provide accurate, practical examples that native speakers would use
8. Focus on the most common meanings and uses


SEPARABLE VERB DETECTION:
- Common separable prefixes: aan, af, bij, door, in, mee, na, om, onder, op, over, toe, uit, vast, weg, voorbij, terug, voor
- If word starts with these prefixes + valid verb, it's separable
- Examples: nadenken (na+denken), uitgaan (uit+gaan), meenemen (mee+nemen)
- ALWAYS show separation in present tense: "ik denk na" not "ik nadenk"

VERB CONJUGATION ANALYSIS:
- CRITICAL: Always return the INFINITIVE form in dutch_lemma field for single-word verbs.
- If input is conjugated verb (straalde, straalt, gestraald), find infinitive (stralen)
- Common patterns:
  - Past tense: -de/-te ending → infinitive (straalde → stralen)
  - Present tense: -t ending → infinitive (straalt → stralen)
  - Perfect tense: ge- prefix → infinitive (gestraald → stralen)
- For irregular verbs, use your expertise to find correct infinitive
- Examples:
  - "straalde" → dutch_lemma: "stralen"
  - "kocht" → dutch_lemma: "kopen"
  - "ging" → dutch_lemma: "gaan"
  - "was" → dutch_lemma: "zijn"

ARTICLE USAGE RULES:
- CRITICAL: Only NOUNS get articles (de/het)
- All other parts of speech get article = null
- Examples:
  - "huis" (noun) → article: "het" (het huis)
  - "verloofd" (adjective) → article: null
  - "lopen" (verb) → article: null
  - "mooi" (adjective) → article: null
  - "snel" (adverb) → article: null
  - "in" (preposition) → article: null
- NEVER use articles with adjectives, verbs, adverbs, prepositions, conjunctions

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
