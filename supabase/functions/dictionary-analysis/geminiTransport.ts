import { record, sha256, type PreparedGeminiRequest } from './protectedInput.ts'
import {
  providerDiagnostics,
  type ProviderDiagnostics,
} from './providerDiagnostics.ts'
import type {
  ProviderObservation,
  TransportReason,
} from './providerObservation.ts'

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

class ResponseReadError extends Error {
  constructor(readonly reason: TransportReason) {
    super(reason)
  }
}

const readBoundedResponse = async (response: Response): Promise<string> => {
  if (!response.body) throw new ResponseReadError('missing-response-body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > RESPONSE_BYTE_LIMIT) {
        throw new ResponseReadError('response-too-large')
      }
      chunks.push(chunk.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error instanceof ResponseReadError
      ? error
      : new ResponseReadError('response-read-failed')
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new ResponseReadError('response-decode-failed')
  }
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
  observe?: (observation: ProviderObservation) => void
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
      const startedAt = performance.now()
      let httpStatus: number | null = null
      let googleStatus: string | null = null
      let reason: TransportReason = 'fetch-failed'
      let outcome: ProviderObservation['outcome'] = 'provider-outcome-unknown'
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
        httpStatus = response.status
        reason = 'response-read-failed'
        if (!response.ok) unsuccessfulStatus = response.status
        const body = await readBoundedResponse(response)
        reason = 'response-processing-failed'
        if (!response.ok) {
          const diagnostics = providerDiagnostics(response.status, body)
          googleStatus = diagnostics.google_status
          reason = 'http-error'
          // An explicit client/rate-limit rejection is known. A server failure may
          // occur after generation; do not assume a 5xx permits another paid call.
          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 408
          ) {
            const evidence = await sha256(
              JSON.stringify({ status: response.status, body })
            )
            outcome = 'provider-failed'
            return {
              kind: 'provider-failed',
              evidence_sha256: evidence,
              diagnostics,
            }
          }
          return {
            kind: 'provider-outcome-unknown',
            evidence_sha256: null,
            diagnostics,
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
        reason = 'response-received'
        outcome = 'returned'
        return { kind: 'returned', result, requestId }
      } catch (error) {
        if (controller.signal.aborted) reason = 'timeout'
        else if (error instanceof ResponseReadError) reason = error.reason
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
        if (options.observe) {
          try {
            // Hash internal invocation keys; do not expose raw identifiers,
            // request/response content, headers, URLs or exception messages.
            options.observe({
              attempt_sha256: await sha256(attemptId),
              outcome,
              reason,
              http_status: httpStatus,
              google_status: googleStatus,
              elapsed_ms: Math.max(
                0,
                Math.round(performance.now() - startedAt)
              ),
            })
          } catch {
            // Logging failure must never change a paid result or cause a retry.
          }
        }
      }
    },
  }
}
