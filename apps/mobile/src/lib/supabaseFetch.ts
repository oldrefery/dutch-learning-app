import fetchRetry from 'fetch-retry'

export const AUTH_REQUEST_TIMEOUT_MS = 10000

/** Bound native Auth transport; the Auth SDK owns refresh retries/rotation. */
export function createSupabaseFetch(
  supabaseUrl: string,
  transport: typeof fetch
): typeof fetch {
  const authPrefix = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/`
  const retryDataRequest = fetchRetry(transport, {
    retries: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
    retryOn: [503, 504, 520, 546],
  })

  return async (input, init) => {
    const request =
      typeof Request !== 'undefined' && input instanceof Request
        ? input
        : undefined
    const url = request?.url ?? String(input)
    if (!url.startsWith(authPrefix)) return retryDataRequest(input, init)

    const controller = new AbortController()
    const signal = init?.signal === undefined ? request?.signal : init.signal
    const abort = () => controller.abort()
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort)
    const timer = setTimeout(abort, AUTH_REQUEST_TIMEOUT_MS)
    try {
      return await transport(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
}
