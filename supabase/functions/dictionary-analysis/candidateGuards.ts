import {
  canonicalizeJson,
  canonicalizeCefrInput,
  parseDictionaryContent,
  type DictionaryContent,
} from '../../../packages/domain/src/shared-dictionary.ts'
import type { DictionaryAnalysisDecisionCode } from '../../../packages/domain/src/dictionary-publication.ts'
import { parseProtectedAnalysisInput, sha256 } from './protectedInput.ts'
import type { EvaluationContext } from './worker.ts'

export type CandidateInspection =
  | {
      valid: true
      content: DictionaryContent
      content_sha256: string
      cefr_input_sha256: string
    }
  | {
      valid: false
      decision_code: Extract<
        DictionaryAnalysisDecisionCode,
        'schema-invalid' | 'identity-mismatch' | 'unsafe-media'
      >
    }

export const safeMedia = (
  url: string | null,
  prefixes: readonly string[]
): boolean => {
  if (url === null) return true
  if (
    !/^https:\/\/[a-z0-9.-]+(:[0-9]+)?\//.test(url) ||
    /[\s\\?#]/.test(url) ||
    /(\/\.\.?\/|%2e|%2f|%5c)/i.test(url)
  )
    return false
  try {
    if (new URL(url).href !== url) return false
  } catch {
    return false
  }
  return prefixes.some(
    prefix =>
      /^https:\/\/[a-z0-9.-]+(:[0-9]+)?\/[^?#\s\\]*\/$/.test(prefix) &&
      url.startsWith(prefix)
  )
}

export const inspectCandidate = async (
  context: EvaluationContext,
  mediaPrefixes: readonly string[]
): Promise<CandidateInspection> => {
  const input = parseProtectedAnalysisInput(context.input)
  const parsed = parseDictionaryContent(context.result.content)
  if (!parsed.success) return { valid: false, decision_code: 'schema-invalid' }
  const content = parsed.data
  if (
    content.dutch_lemma !== input.entry.lemma ||
    content.part_of_speech !== input.entry.part_of_speech ||
    content.article !== input.entry.article
  )
    return { valid: false, decision_code: 'identity-mismatch' }
  if (
    !safeMedia(content.image_url, mediaPrefixes) ||
    !safeMedia(content.tts_url, mediaPrefixes)
  )
    return { valid: false, decision_code: 'unsafe-media' }
  return {
    valid: true,
    content,
    content_sha256: await sha256(canonicalizeJson(content)),
    cefr_input_sha256: await sha256(canonicalizeCefrInput(content)),
  }
}
