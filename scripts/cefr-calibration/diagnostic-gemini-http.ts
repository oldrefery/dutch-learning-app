export const GEMINI_MODEL = 'gemini-3.5-flash'
export const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`
const TEST_KEY = 'TEST-ONLY-NOT-A-CREDENTIAL'
export type TestHttp = (url: string, init: RequestInit) => Promise<Response>

export class GeminiHttpFailure extends Error {
  readonly status: number
  readonly retryAfterMs: number | undefined
  constructor(status: number, retryAfterMs?: number) {
    super('Gemini HTTP failure')
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}
export class GeminiEnvelopeFailure extends Error {
  constructor() {
    super('Gemini transport or envelope rejected')
  }
}
export class GeminiTimeoutFailure extends Error {
  constructor() {
    super('Gemini transport rejected: timeout')
  }
}
const rejectEnvelope = (): never => {
  throw new GeminiEnvelopeFailure()
}
const cancelBody = (response: Response): void => {
  if (response.body && !response.body.locked)
    void response.body.cancel().catch(() => {})
}
const readBounded = async (
  response: Response,
  signal: AbortSignal
): Promise<unknown> => {
  if (!response.body) return rejectEnvelope()
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = []
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  let size = 0
  try {
    signal.throwIfAborted()
    while (true) {
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > 16 * 1024) return rejectEnvelope()
      chunks.push(value)
    }
    try {
      return JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
      ) as unknown
    } catch {
      return rejectEnvelope()
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
    reader.releaseLock()
  }
}
const validateResponse = (response: Response, url: string): void => {
  if (response.redirected || (response.url && response.url !== url))
    rejectEnvelope()
  if (!response.ok) {
    const value = response.headers.get('retry-after')
    const seconds = value && /^\d+$/.test(value) ? Number(value) : null
    const delay =
      seconds !== null
        ? seconds * 1000
        : value
          ? Date.parse(value) - Date.now()
          : NaN
    throw new GeminiHttpFailure(
      response.status,
      Number.isFinite(delay) ? Math.max(0, delay) : undefined
    )
  }
  const mediaType = response.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (response.status !== 200 || mediaType !== 'application/json')
    rejectEnvelope()
}

// An explicit injected HTTP function and dummy key are the only dispatch path.
export const createGeminiTestHttp = (http: TestHttp, timeout: number) => {
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 5000)
    throw new Error('Invalid Gemini preparation: timeout_bound')
  return async (
    method: string,
    suffix: string,
    body?: string
  ): Promise<unknown> => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const url = `${GEMINI_BASE}${suffix}`
    const receive = async () => {
      const response = await http(url, {
        method,
        headers: {
          'x-goog-api-key': TEST_KEY,
          'Content-Type': 'application/json',
        },
        ...(body ? { body } : {}),
        redirect: 'error',
        signal: controller.signal,
      })
      try {
        // A transport may settle after the caller's timeout. Never consume it then.
        controller.signal.throwIfAborted()
        validateResponse(response, url)
        return await readBounded(response, controller.signal)
      } finally {
        cancelBody(response)
      }
    }
    try {
      return await Promise.race([
        receive(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort(new GeminiTimeoutFailure())
            reject(new GeminiTimeoutFailure())
          }, timeout)
        }),
      ])
    } catch (error) {
      if (controller.signal.reason instanceof GeminiTimeoutFailure)
        throw new GeminiTimeoutFailure()
      controller.abort()
      if (
        error instanceof GeminiHttpFailure ||
        error instanceof GeminiEnvelopeFailure
      )
        throw error
      // Network errors and aborts carry no provider content or credentials.
      throw new Error('Gemini transport or envelope rejected')
    } finally {
      clearTimeout(timer)
    }
  }
}
