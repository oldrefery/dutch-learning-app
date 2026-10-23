import { record, sha256, type PreparedGeminiRequest } from './protectedInput.ts'
import {
  providerDiagnostics,
  type ProviderDiagnostics,
} from './providerDiagnostics.ts'

const RESPONSE_BYTE_LIMIT = 32768
export type ProviderOutcome =
  | { kind: 'returned'; result: Record<string, unknown>; requestId: string }
  | {
      kind: 'provider-failed'
      evidence_sha256: string
      diagnostics?: ProviderDiagnostics
    }
  | {
      kind: 'provider-outcome-unknown'
      evidence_sha256: null
      diagnostics?: ProviderDiagnostics
    }
export interface GeminiTransport {
  invoke(
    request: PreparedGeminiRequest,
    attemptId: string
  ): Promise<ProviderOutcome>
}

const readBoundedResponse = async (response: Response): Promise<string> => {
  if (!response.body) throw new Error('missing-provider-response')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > RESPONSE_BYTE_LIMIT)
        throw new Error('oversized-provider-response')
      chunks.push(chunk.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

// Preserve the provider envelope, including blocked/truncated/malformed output.
// Schema/meaning acceptance belongs to an independent evaluator, never this parser.
export const journalPacket = (body: string): Record<string, unknown> => {
  let envelope: Record<string, unknown>
  try {
    envelope = record(JSON.parse(body))
  } catch {
    return { content: null, provider_response: { unparseable_body: body } }
  }
  let candidateContent: unknown = null
  try {
    const candidates = envelope.candidates
    if (
      !envelope.promptFeedback ||
      !record(envelope.promptFeedback).blockReason
    ) {
      if (Array.isArray(candidates) && candidates.length === 1) {
        const candidate = record(candidates[0])
        const parts = record(candidate.content).parts
        if (candidate.finishReason === 'STOP' && Array.isArray(parts)) {
          const output = parts.map(record).filter(part => part.thought !== true)
          if (
            output.length > 0 &&
            output.every(
              part =>
                typeof part.text === 'string' &&
                (part.thought === undefined ||
                  typeof part.thought === 'boolean') &&
                (part.thoughtSignature === undefined ||
                  typeof part.thoughtSignature === 'string') &&
                Object.keys(part).every(key =>
                  ['text', 'thought', 'thoughtSignature'].includes(key)
                )
            )
          ) {
            const parsed = record(
              JSON.parse(output.map(part => part.text).join(''))
            )
            if (
              Object.keys(parsed).length === 1 &&
              Object.hasOwn(parsed, 'content')
            )
              candidateContent = parsed.content
          }
        }
      }
    }
  } catch {
    /* Keep malformed output in the durable envelope for rejection. */
  }
  return { content: candidateContent, provider_response: envelope }
}

export const createGeminiTransport = (options: {
  apiKey: string
  fetch: typeof fetch
  timeoutMs?: number
}): GeminiTransport => {
  const timeoutMs = options.timeoutMs ?? 60000
  if (
    !options.apiKey.trim() ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 120000
  )
    throw new Error('invalid-provider-configuration')
  return {
    async invoke(request, attemptId) {
      if (!/^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(request.model))
        throw new Error('invalid-provider-configuration')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let unsuccessfulStatus: number | null = null
      try {
        // No retry, redirect or SDK retry middleware for a non-idempotent paid call.
        const response = await options.fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': options.apiKey,
            },
            body: request.body,
            redirect: 'error',
            signal: controller.signal,
          }
        )
        if (!response.ok) unsuccessfulStatus = response.status
        const body = await readBoundedResponse(response)
        if (!response.ok) {
          // An explicit client/rate-limit rejection is known. A server failure may
          // occur after generation; do not assume a 5xx permits another paid call.
          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 408
          )
            return {
              kind: 'provider-failed',
              evidence_sha256: await sha256(
                JSON.stringify({ status: response.status, body })
              ),
              diagnostics: providerDiagnostics(response.status, body),
            }
          return {
            kind: 'provider-outcome-unknown',
            evidence_sha256: null,
            diagnostics: providerDiagnostics(response.status, body),
          }
        }
        const result = journalPacket(body)
        const providerId = record(result.provider_response).responseId
        const requestId =
          typeof providerId === 'string' &&
          /^[A-Za-z0-9_.:-]{1,200}$/.test(providerId)
            ? providerId
            : `worker:${attemptId}`
        if (requestId.length > 200) throw new Error('invalid-attempt-id')
        return { kind: 'returned', result, requestId }
      } catch {
        // Aborting locally does not cancel/undo processing at the provider.
        return {
          kind: 'provider-outcome-unknown',
          evidence_sha256: null,
          ...(unsuccessfulStatus === null
            ? {}
            : { diagnostics: providerDiagnostics(unsuccessfulStatus, null) }),
        }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
