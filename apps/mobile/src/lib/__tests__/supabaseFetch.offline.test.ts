import { AuthClient } from '@supabase/supabase-js'
import { createSupabaseFetch } from '../supabaseFetch'

jest.unmock('@supabase/supabase-js')

const base = 'https://offline-qa.example.invalid'
const storageKey = 'qa-offline-session'
const day = 24 * 60 * 60 * 1000
const start = Date.parse('2026-09-06T06:00:00Z')
const saved = {
  access_token: 'initial-test-access',
  refresh_token: 'initial-test-refresh',
  expires_at: start / 1000 + 3600,
  token_type: 'bearer',
  user: { id: 'synthetic-offline-user' },
}

// Model days without running timers while the process is absent. The actual
// Auth SDK and app transport run; storage, server responses and time are doubles.
describe('native session persistence over extended offline periods', () => {
  const transport = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >()
  let values: Map<string, string>
  let clients: InstanceType<typeof AuthClient>[]
  const events = jest.fn()
  const createClient = (autoRefreshToken = false) => {
    const client = new AuthClient({
      url: `${base}/auth/v1`,
      storageKey,
      persistSession: true,
      autoRefreshToken,
      detectSessionInUrl: false,
      storage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => {
          values.set(key, value)
        },
        removeItem: key => {
          values.delete(key)
        },
      },
      fetch: createSupabaseFetch(base, transport),
    })
    clients.push(client)
    return client
  }
  const allowRotation = (expectedToken: string, nextToken: string) => {
    transport.mockImplementation(async (url, init) => {
      expect(String(url)).toBe(`${base}/auth/v1/token?grant_type=refresh_token`)
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        refresh_token: expectedToken,
      })
      return new Response(
        JSON.stringify({
          ...saved,
          access_token: `access-for-${nextToken}`,
          refresh_token: nextToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
        }),
        { status: 200 }
      )
    })
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: start })
    values = new Map([[storageKey, JSON.stringify(saved)]])
    clients = []
    events.mockReset()
    transport.mockReset()
  })

  afterEach(async () => {
    for (const client of clients) await client.stopAutoRefresh()
    jest.useRealTimers()
  })

  it.each(['rejected', 'stalled', '503'] as const)(
    'preserves credentials through repeated %s failures and rotates across restarts',
    async mode => {
      if (mode === 'rejected')
        transport.mockRejectedValue(new TypeError('Network unavailable'))
      else if (mode === '503')
        transport.mockImplementation(
          async () => new Response('{}', { status: 503 })
        )
      else
        transport.mockImplementation(
          (_, init) =>
            new Promise((_, reject) => {
              init?.signal?.addEventListener('abort', () =>
                reject(new Error('Aborted'))
              )
            })
        )

      for (const elapsedDays of [1, 3, 7]) {
        jest.setSystemTime(start + elapsedDays * day)
        const client = createClient()
        await client.initialize()
        const {
          data: { subscription },
        } = client.onAuthStateChange(events)
        const reads = Promise.all([client.getSession(), client.getSession()])
        await jest.advanceTimersByTimeAsync(120000)
        for (const result of await reads) {
          expect(result.error?.name).toBe('AuthRetryableFetchError')
          expect(result.data.session).toBeNull()
        }
        expect(values.get(storageKey)).toBe(JSON.stringify(saved))
        expect(events.mock.calls.map(([event]) => event)).not.toContain(
          'SIGNED_OUT'
        )
        expect(jest.getTimerCount()).toBe(0)
        subscription.unsubscribe()
        await client.stopAutoRefresh()
      }

      transport.mockClear()
      allowRotation(saved.refresh_token, 'rotation-one')
      const recovered = createClient(true)
      await recovered.initialize()
      const results = await Promise.all([
        recovered.getSession(),
        recovered.getSession(),
      ])
      for (const result of results) {
        expect(result.error).toBeNull()
        expect(result.data.session?.user.id).toBe(saved.user.id)
        expect(result.data.session?.refresh_token).toBe('rotation-one')
      }
      expect(transport).toHaveBeenCalledTimes(1)
      expect(JSON.parse(values.get(storageKey)!)).toMatchObject({
        user: saved.user,
        refresh_token: 'rotation-one',
      })
      await recovered.stopAutoRefresh()

      jest.setSystemTime(start + 9 * day)
      transport.mockClear()
      allowRotation('rotation-one', 'rotation-two')
      const restarted = createClient(true)
      await restarted.initialize()
      expect((await restarted.getSession()).data.session?.refresh_token).toBe(
        'rotation-two'
      )
      expect(transport).toHaveBeenCalledTimes(1)
      expect(JSON.parse(values.get(storageKey)!)).toMatchObject({
        user: saved.user,
        refresh_token: 'rotation-two',
      })
    }
  )

  it('recovers an offline cold start with automatic refresh enabled, without a new client', async () => {
    jest.setSystemTime(start + 7 * day)
    transport.mockImplementation(
      async () => new Response('{}', { status: 503 })
    )
    const client = createClient(true)
    const initialization = client.initialize()
    await jest.advanceTimersByTimeAsync(40000)
    await initialization
    // Model the provider stopping background polling; drain any in-flight tick.
    await client.stopAutoRefresh()
    await jest.advanceTimersByTimeAsync(40000)
    expect(values.get(storageKey)).toBe(JSON.stringify(saved))
    expect(jest.getTimerCount()).toBe(0)

    const {
      data: { subscription },
    } = client.onAuthStateChange(events)
    allowRotation(saved.refresh_token, 'cold-start-rotation')
    try {
      const result = await client.getSession()
      expect(result.error).toBeNull()
      expect(result.data.session?.user.id).toBe(saved.user.id)
      expect(result.data.session?.refresh_token).toBe('cold-start-rotation')
      expect(events).toHaveBeenCalledWith(
        'TOKEN_REFRESHED',
        expect.objectContaining({
          user: saved.user,
          refresh_token: 'cold-start-rotation',
        })
      )
      expect(events.mock.calls.map(([event]) => event)).not.toContain(
        'SIGNED_OUT'
      )
      expect(JSON.parse(values.get(storageKey)!)).toMatchObject({
        refresh_token: 'cold-start-rotation',
      })
    } finally {
      subscription.unsubscribe()
    }
  })

  it.each([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
  ])(
    'does not resurrect a session rejected with %s after a week away',
    async code => {
      jest.setSystemTime(start + 7 * day)
      transport.mockImplementation(
        async () =>
          new Response(JSON.stringify({ code, message: 'Session revoked' }), {
            status: 400,
            headers: { 'X-Supabase-Api-Version': '2024-01-01' },
          })
      )
      const client = createClient()
      await client.initialize()
      const result = await client.getSession()
      expect(result.error).not.toBeNull()
      if (code === 'session_not_found')
        expect(result.error?.name).toBe('AuthSessionMissingError')
      else expect(result.error?.code).toBe(code)
      expect(result.data.session).toBeNull()
      expect(values.has(storageKey)).toBe(false)
      expect(transport).toHaveBeenCalledTimes(1)

      const restarted = createClient(true)
      await restarted.initialize()
      expect((await restarted.getSession()).data.session).toBeNull()
      expect(values.has(storageKey)).toBe(false)
      expect(transport).toHaveBeenCalledTimes(1)
    }
  )
})
