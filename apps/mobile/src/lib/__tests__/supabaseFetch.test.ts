import { AUTH_REQUEST_TIMEOUT_MS, createSupabaseFetch } from '../supabaseFetch'

const base = 'https://qa.example.invalid'
const tokenUrl = `${base}/auth/v1/token?grant_type=refresh_token`
const response = { ok: true, status: 200 } as Response

describe('native Supabase transport', () => {
  const transport = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >()
  const request = createSupabaseFetch(`${base}/`, transport)

  beforeEach(() => {
    jest.useFakeTimers()
    transport.mockReset().mockResolvedValue(response)
  })
  afterEach(() => jest.useRealTimers())

  it('aborts a stalled Auth request and allows a fresh request after recovery', async () => {
    let signal: AbortSignal | null | undefined
    transport.mockImplementationOnce(
      (_, init) =>
        new Promise((_, reject) => {
          signal = init?.signal
          signal?.addEventListener('abort', () => reject(new Error('Aborted')))
        })
    )
    const pending = request(tokenUrl, { method: 'POST', body: 'refresh-body' })
    const failure = expect(pending).rejects.toThrow('Aborted')
    await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS - 1)
    expect(signal?.aborted).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    await failure
    expect(signal?.aborted).toBe(true)
    expect(transport).toHaveBeenCalledTimes(1)
    await expect(request(tokenUrl)).resolves.toBe(response)
    expect(transport).toHaveBeenCalledTimes(2)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('passes Auth payloads unchanged and clears the timer after success', async () => {
    const init = { method: 'POST', body: 'payload', headers: { apikey: 'qa' } }
    await expect(request(tokenUrl, init)).resolves.toBe(response)
    expect(transport).toHaveBeenCalledWith(tokenUrl, {
      ...init,
      signal: expect.any(AbortSignal),
    })
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each([400, 401, 503])(
    'leaves Auth HTTP %i interpretation/retry to the SDK',
    async status => {
      const result = { status, ok: false } as Response
      transport.mockResolvedValue(result)
      await expect(request(tokenUrl)).resolves.toBe(result)
      expect(transport).toHaveBeenCalledTimes(1)
      expect(jest.getTimerCount()).toBe(0)
    }
  )

  it('does not multiply SDK network retries', async () => {
    const error = new TypeError('Network unavailable')
    transport.mockRejectedValue(error)
    await expect(request(tokenUrl)).rejects.toBe(error)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each([false, true])(
    'preserves caller cancellation (already aborted: %s)',
    async alreadyAborted => {
      const controller = new AbortController()
      if (alreadyAborted) controller.abort()
      const remove = jest.spyOn(controller.signal, 'removeEventListener')
      transport.mockImplementationOnce(
        (_, init) =>
          new Promise((_, reject) => {
            if (init?.signal?.aborted) reject(new Error('Aborted'))
            else
              init?.signal?.addEventListener('abort', () =>
                reject(new Error('Aborted'))
              )
          })
      )
      const pending = request(tokenUrl, { signal: controller.signal })
      const failure = expect(pending).rejects.toThrow('Aborted')
      controller.abort()
      await failure
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
      expect(jest.getTimerCount()).toBe(0)
    }
  )

  it('preserves the existing data-request retries and caller signal', async () => {
    const signal = new AbortController().signal
    transport.mockResolvedValueOnce({ status: 503 } as Response)
    const pending = request(`${base}/rest/v1/words`, { signal })
    await jest.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toBe(response)
    expect(transport).toHaveBeenCalledTimes(2)
    expect(transport).toHaveBeenLastCalledWith(`${base}/rest/v1/words`, {
      signal,
    })
    expect(jest.getTimerCount()).toBe(0)
  })

  it('does not apply Auth policy to another origin', async () => {
    const url = 'https://another.example.invalid/auth/v1/token'
    await request(url)
    expect(transport).toHaveBeenCalledWith(url, undefined)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('handles URL objects as Auth requests', async () => {
    const url = new URL(tokenUrl)
    await request(url)
    expect(transport).toHaveBeenCalledWith(url, {
      signal: expect.any(AbortSignal),
    })
  })

  it.each(['inherited', 'overridden', 'removed'] as const)(
    'honors a Request signal when %s by init',
    async mode => {
      const original = new AbortController()
      const override = new AbortController()
      const input = new Request(tokenUrl, { signal: original.signal })
      const init =
        mode === 'inherited'
          ? undefined
          : {
              signal: mode === 'overridden' ? override.signal : null,
            }
      let resolve: (value: Response) => void = () => {}
      let actual: AbortSignal | null | undefined
      transport.mockImplementationOnce(
        (_, options) =>
          new Promise(finish => {
            resolve = finish
            actual = options?.signal
          })
      )
      const pending = request(input, init)
      original.abort()
      expect(actual?.aborted).toBe(mode === 'inherited')
      override.abort()
      expect(actual?.aborted).toBe(mode !== 'removed')
      resolve(response)
      await pending
      expect(jest.getTimerCount()).toBe(0)
    }
  )

  it('cleans up even when transport throws synchronously', async () => {
    transport.mockImplementation(() => {
      throw new Error('Transport error')
    })
    await expect(request(tokenUrl)).rejects.toThrow('Transport error')
    expect(jest.getTimerCount()).toBe(0)
  })
})
