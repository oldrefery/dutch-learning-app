import { FunctionsClient } from '@supabase/functions-js'
import { createSupabaseFetch } from '../supabaseFetch'

const base = 'https://qa.example.invalid'
const url = `${base}/functions/v1/dictionary-creation`
const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const request = createSupabaseFetch(base, transport)
describe('native creation transport never redispatches durable intent', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    transport.mockReset()
  })
  afterEach(() => {
    expect(jest.getTimerCount()).toBe(0)
    jest.useRealTimers()
  })
  it.each([503, 504, 520, 546])(
    'does not retry HTTP %i, preserving exact command and abort signal',
    async status => {
      const response = { status, ok: false } as Response
      transport.mockResolvedValue(response)
      const init = {
        method: 'POST',
        body: 'exact-operation',
        signal: new AbortController().signal,
      }
      await expect(
        request(`${url}/?forceFunctionRegion=eu-west-1`, init)
      ).resolves.toBe(response)
      expect(transport).toHaveBeenCalledTimes(1)
      expect(transport).toHaveBeenCalledWith(expect.any(String), init)
    }
  )
  it('does not retry a lost network response', async () => {
    const error = new TypeError('Connection lost')
    transport.mockRejectedValue(error)
    await expect(request(new Request(url, { method: 'POST' }))).rejects.toBe(
      error
    )
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('keeps an actual FunctionsClient failure to one fake transport request', async () => {
    transport.mockResolvedValue(
      new Response('{}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const client = new FunctionsClient(`${base}/functions/v1`, {
      customFetch: request,
    })
    const body = {
      protocol_version: 2,
      operation_id: 'synthetic-operation',
      resolution_id: 'synthetic-resolution',
    }
    const signal = new AbortController().signal
    const result = await client.invoke('dictionary-creation', {
      body,
      signal,
      headers: { Authorization: 'Bearer synthetic-token' },
    })
    expect(result.error).not.toBeNull()
    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ body: JSON.stringify(body), signal })
    )
  })
})
