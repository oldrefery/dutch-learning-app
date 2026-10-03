import { createHash } from 'node:crypto'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { isPreparedBundle, type DiagnosticBundle } from './diagnostic-bundle.ts'
import type { DiagnosticReply, DiagnosticRequest } from './diagnostic-types.ts'

export const GEMINI_MODEL = 'gemini-3.5-flash'
export const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`
const TEST_KEY = 'TEST-ONLY-NOT-A-CREDENTIAL'
export const requestDigest = (body: string): string =>
  createHash('sha256').update(body).digest('hex')
const fail = (code: string): never => {
  throw new Error(`Invalid Gemini preparation: ${code}`)
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('object_required')
  return value as Record<string, unknown>
}
const text = (value: unknown): string => {
  if (typeof value !== 'string' || !value || Buffer.byteLength(value) > 200)
    return fail('receipt_identity')
  return value
}
const token = (value: unknown, max: number): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    return fail('token_bound')
  return value as number
}

export interface GeminiPreparedRequest {
  readonly itemId: string
  readonly diagnostic: DiagnosticRequest
  readonly body: string
  readonly sha256: string
}
const preparedRequests = new WeakSet<object>()
export const prepareGeminiRequest = (
  bundle: DiagnosticBundle,
  itemId: string,
  runId: string
): GeminiPreparedRequest => {
  if (!isPreparedBundle(bundle)) return fail('unvalidated_bundle')
  const config = bundle.profile.generation_config
  if (
    bundle.profile.provider !== 'google-gemini-developer-api' ||
    bundle.profile.requested_model !== GEMINI_MODEL ||
    canonicalizeJson(config) !==
      canonicalizeJson({
        max_output_tokens: 2048,
        temperature: 0,
        thinking_level: 'low',
        include_thoughts: false,
        candidate_count: 1,
        response_mime_type: 'application/json',
      }) ||
    bundle.maxInputTokens !== 2000 ||
    bundle.maxOutputTokens !== 2048 ||
    bundle.rates.input !== 1.5 ||
    bundle.rates.output !== 9 ||
    bundle.rates.reasoning !== 9
  )
    return fail('unsupported_profile_or_price')
  if (!/^[a-f0-9-]{36}$/.test(runId)) return fail('run_identity')
  const meaning = bundle.meanings.find(item => item.id === itemId)
  if (!meaning) return fail('unknown_item')
  // Stable meaning identity across attempts makes the entire counted body reusable.
  // Attempts and response IDs remain separate in the future generation ledger.
  const diagnostic: DiagnosticRequest = {
    job_id: `${runId}:${itemId}`,
    input_sha256: meaning.inputHash,
    profile_sha256: bundle.profileSha256,
    canonical_input: meaning.input,
    prompt: bundle.prompt,
    profile: bundle.profile,
  }
  const body = JSON.stringify({
    model: `models/${GEMINI_MODEL}`,
    systemInstruction: { parts: [{ text: bundle.prompt }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `REQUEST_IDENTITY\n${JSON.stringify({ job_id: diagnostic.job_id, input_sha256: diagnostic.input_sha256, profile_sha256: diagnostic.profile_sha256 })}\nINPUT_JSON\n${meaning.input}`,
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0,
      candidateCount: 1,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
    },
    serviceTier: 'standard',
    store: false,
  })
  if (Buffer.byteLength(body) > 32 * 1024) return fail('request_bytes')
  Object.freeze(diagnostic)
  const request = Object.freeze({
    itemId,
    diagnostic,
    body,
    sha256: requestDigest(body),
  })
  preparedRequests.add(request)
  return request
}

export const parseGeminiGeneration = (
  value: unknown,
  expectedVersion: string | null
): DiagnosticReply => {
  const raw = object(value)
  const response_id = text(raw.responseId),
    model_version = text(raw.modelVersion)
  if (
    !(
      model_version === GEMINI_MODEL ||
      model_version.startsWith(`${GEMINI_MODEL}-`)
    ) ||
    (expectedVersion !== null && model_version !== expectedVersion)
  )
    return fail('model_version_changed')
  const usage = object(raw.usageMetadata)
  if (usage.serviceTier !== 'standard') return fail('service_tier_unverified')
  token(usage.cachedContentTokenCount ?? 0, 0)
  token(usage.toolUsePromptTokenCount ?? 0, 0)
  const input_tokens = token(usage.promptTokenCount, 2000)
  const output_tokens = token(usage.candidatesTokenCount ?? 0, 2048)
  const reasoning_tokens = token(usage.thoughtsTokenCount ?? 0, 2048)
  if (
    output_tokens + reasoning_tokens > 2048 ||
    token(usage.totalTokenCount, 4048) !==
      input_tokens + output_tokens + reasoning_tokens
  )
    return fail('usage_sum_or_combined_bound')
  // A blocked/malformed candidate retains the verified billing receipt.
  let body = '',
    finish_reason = 'INVALID_CANDIDATE'
  try {
    if (Array.isArray(raw.candidates) && raw.candidates.length === 1) {
      const candidate = object(raw.candidates[0])
      finish_reason = text(candidate.finishReason)
      const content = candidate.content ? object(candidate.content) : null
      if (content && Array.isArray(content.parts)) {
        const parts = content.parts.map(object)
        if (
          parts.every(
            part =>
              typeof part.text === 'string' &&
              !part.thought &&
              Object.keys(part).every(key =>
                ['text', 'thought', 'thoughtSignature'].includes(key)
              )
          )
        )
          body = parts.map(part => part.text).join('')
      }
    }
  } catch {
    body = ''
    finish_reason = 'INVALID_CANDIDATE'
  }
  return {
    kind: 'response',
    body,
    response_id,
    model_version,
    finish_reason,
    usage: { input_tokens, output_tokens, reasoning_tokens },
  }
}

export interface GeminiModelMetadata {
  name: string
  baseModelId: string
  thinking: true
  supportedGenerationMethods: string[]
  version: string
  inputTokenLimit: number
  outputTokenLimit: number
}
export const parseGeminiMetadata = (value: unknown): GeminiModelMetadata => {
  const raw = object(value)
  const methods = raw.supportedGenerationMethods
  if (
    raw.name !== `models/${GEMINI_MODEL}` ||
    raw.baseModelId !== GEMINI_MODEL ||
    raw.thinking !== true ||
    !Array.isArray(methods) ||
    !['generateContent', 'countTokens'].every(method =>
      methods.includes(method)
    )
  )
    return fail('model_metadata_mismatch')
  const inputTokenLimit = token(raw.inputTokenLimit, 10_000_000)
  const outputTokenLimit = token(raw.outputTokenLimit, 10_000_000)
  if (inputTokenLimit < 2000 || outputTokenLimit < 2048)
    return fail('model_limits')
  // models.get version is descriptive metadata, not response.modelVersion.
  return {
    name: raw.name,
    baseModelId: GEMINI_MODEL,
    thinking: true,
    supportedGenerationMethods: ['generateContent', 'countTokens'],
    version: text(raw.version),
    inputTokenLimit,
    outputTokenLimit,
  }
}

export type TestHttp = (url: string, init: RequestInit) => Promise<Response>
class HttpFailure extends Error {
  readonly status: number
  constructor(status: number) {
    super('Gemini HTTP failure')
    this.status = status
  }
}
const readBounded = async (response: Response): Promise<unknown> => {
  if (!response.body) return fail('empty_body')
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16 * 1024) return fail('response_bytes')
      chunks.push(value)
    }
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
    ) as unknown
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

// Mandatory injected test HTTP and fixed dummy key: no global fetch/env/live mode.
// This exercises the real REST wire contract without offering paid execution.
export const createGeminiTestAdapter = (options: {
  mode: 'test-only'
  http: TestHttp
  timeoutMs?: number
}) => {
  if (options.mode !== 'test-only' || typeof options.http !== 'function')
    return fail('test_http_required')
  const http = options.http,
    timeout = options.timeoutMs ?? 5000
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 5000)
    return fail('timeout_bound')
  const send = async (
    method: string,
    suffix: string,
    body?: string
  ): Promise<unknown> => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        (async () => {
          const response = await http(`${GEMINI_BASE}${suffix}`, {
            method,
            headers: {
              'x-goog-api-key': TEST_KEY,
              'Content-Type': 'application/json',
            },
            ...(body ? { body } : {}),
            redirect: 'error',
            signal: controller.signal,
          })
          if (
            response.redirected ||
            (response.url && response.url !== `${GEMINI_BASE}${suffix}`)
          )
            return fail('redirect_or_url_mismatch')
          if (!response.ok) {
            void response.body?.cancel().catch(() => {})
            throw new HttpFailure(response.status)
          }
          if (
            !response.headers
              .get('content-type')
              ?.toLowerCase()
              .startsWith('application/json')
          )
            return fail('content_type')
          return readBounded(response)
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error('Gemini request timed out'))
          }, timeout)
        }),
      ])
    } catch (error) {
      controller.abort()
      if (error instanceof HttpFailure) throw error
      // Never propagate raw HTTP errors, headers, or provider body text.
      throw new Error('Gemini transport or envelope rejected')
    } finally {
      clearTimeout(timer)
    }
  }
  const checked = (request: GeminiPreparedRequest) => {
    if (!preparedRequests.has(request)) fail('unprepared_request')
  }
  return Object.freeze({
    kind: 'test-only' as const,
    countTokens: async (request: GeminiPreparedRequest): Promise<number> => {
      checked(request)
      const raw = object(
        await send(
          'POST',
          ':countTokens',
          `{"generateContentRequest":${request.body}}`
        )
      )
      return token(raw.totalTokens, 2000)
    },
    modelMetadata: async (): Promise<GeminiModelMetadata> =>
      parseGeminiMetadata(await send('GET', '')),
    generate: async (
      request: GeminiPreparedRequest,
      expectedVersion: string | null
    ) => {
      checked(request)
      let raw: unknown
      try {
        raw = await send('POST', ':generateContent', request.body)
      } catch (error) {
        return error instanceof HttpFailure
          ? { kind: 'http_error' as const, status: error.status }
          : { kind: 'transport_error' as const }
      }
      // Invalid receipts must stop a future live run; they are never retriable answers.
      try {
        return parseGeminiGeneration(raw, expectedVersion)
      } catch {
        return { kind: 'receipt_error' as const }
      }
    },
  })
}
