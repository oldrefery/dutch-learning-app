import { wordAnalysisResponseSchema } from '../dictionary-analysis/responseSchemas.ts'

export const WORD_ANALYSIS_MODEL = 'gemini-3.8-flash'
export const WORD_ANALYSIS_THINKING_LEVEL = 'low'

export const wordAnalysisGenerationConfig = (includeCefr: boolean) => ({
  thinkingConfig: { thinkingLevel: WORD_ANALYSIS_THINKING_LEVEL },
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
  responseJsonSchema: wordAnalysisResponseSchema(includeCefr),
})

export const wordAnalysisRequest = (prompt: string, includeCefr: boolean) => ({
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: wordAnalysisGenerationConfig(includeCefr),
})
