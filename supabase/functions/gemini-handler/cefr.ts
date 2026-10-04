import { API_CONFIG } from './constants.ts'
import {
  ANALYSIS_CEFR_INPUT_VERSION,
  canonicalizeAnalysisCefrInput,
  parseAnalysisCefrEstimate,
  type AnalysisCefrEstimate,
} from '../../../packages/domain/src/analysis-cefr.ts'

export const ANALYSIS_CEFR_METHOD_VERSION = `${new URL(API_CONFIG.GEMINI_API_URL).pathname.split('/models/')[1].split(':')[0]}/word-analysis-cefr-v1`

export const ANALYSIS_CEFR_PROMPT = `
Add an optional "cefr" object: {"level":"A1|A2|B1|B2|C1|C2" or null,"confidence":0.0-1.0 or null}.
Estimate the difficulty of the specific meaning and examples you analyzed.
This is a model estimate, not a verified dictionary or curriculum classification.
If the meaning is ambiguous, evidence is insufficient or you are uncertain,
return {"level":null,"confidence":null}. Do not infer word level from a pack label,
corpus frequency, spelling alone or your general analysis confidence_score.
Do not supply source, review status, input hashes or method/provider metadata.
`

const inputDigest = async (analysis: unknown): Promise<string | null> => {
  const input = canonicalizeAnalysisCefrInput(analysis)
  if (input === null) return null
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  )
  return Array.from(new Uint8Array(digest), x =>
    x.toString(16).padStart(2, '0')
  ).join('')
}

export const createGeminiCefrEstimate = async (
  raw: unknown,
  analysis: unknown
): Promise<AnalysisCefrEstimate | null> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const candidate = raw as Record<string, unknown>
  const digest = await inputDigest(analysis)
  if (!digest) return null
  // Provenance/status come from the server, never from provider output.
  return parseAnalysisCefrEstimate({
    level: candidate.level,
    confidence: candidate.confidence,
    status: candidate.level === null ? 'unknown' : 'estimated',
    source: 'model',
    method: 'gemini',
    method_version: ANALYSIS_CEFR_METHOD_VERSION,
    input_version: ANALYSIS_CEFR_INPUT_VERSION,
    input_sha256: digest,
  })
}

export const readAnalysisCefrEstimate = async (
  value: unknown,
  analysis: unknown
): Promise<AnalysisCefrEstimate | null> => {
  const parsed = parseAnalysisCefrEstimate(value)
  return parsed && parsed.input_sha256 === (await inputDigest(analysis))
    ? parsed
    : null
}
