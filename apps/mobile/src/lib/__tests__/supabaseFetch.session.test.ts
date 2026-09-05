import { AuthClient } from '@supabase/supabase-js'
import { createSupabaseFetch } from '../supabaseFetch'

jest.unmock('@supabase/supabase-js')

const base = 'https://qa.example.invalid'
const storageKey = 'qa-auth-recovery'
const expired = {
  access_token: 'expired-test-token',
  refresh_token: 'saved-test-refresh-token',
  expires_at: 1,
  user: { id: 'qa-session-user' },
}
const refreshed = {
  access_token: 'fresh-test-token',
  refresh_token: 'rotated-test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: expired.user,
}

// Exercise the installed Auth SDK, not a mocked getSession implementation.
describe('native transport with real Auth session recovery', () => {
  const transport = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >()
  let values: Map<string, string>
  let client: InstanceType<typeof AuthClient>
  const success = () => new Response(JSON.stringify(refreshed), { status: 200 })
  const createClient = (autoRefreshToken = false) =>
    new AuthClient({
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

  beforeEach(async () => {
    jest.useFakeTimers()
    values = new Map([[storageKey, JSON.stringify(expired)]])
    transport.mockReset().mockImplementation(async () => success())
    client = createClient()
    await client.initialize()
  })

  afterEach(async () => {
    await client.stopAutoRefresh()
    jest.useRealTimers()
  })

  it('releases stalled refresh work and restores all concurrent session readers', async () => {
    transport.mockImplementationOnce(
      (_, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('Aborted'))
          )
        })
    )
    const a = client.getSession()
    const b = client.getSession()
    await jest.advanceTimersByTimeAsync(10200)
    for (const result of await Promise.all([a, b])) {
      expect(result.error).toBeNull()
      expect(result.data.session?.user.id).toBe(expired.user.id)
      expect(result.data.session?.refresh_token).toBe(refreshed.refresh_token)
    }
    expect(transport).toHaveBeenCalledTimes(2)
    expect(JSON.parse(values.get(storageKey)!)).toMatchObject(refreshed)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('unblocks cold-start initialization and publishes the recovered identity', async () => {
    transport.mockImplementationOnce(
      (_, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('Aborted'))
          )
        })
    )
    client = createClient(true)
    const event = jest.fn()
    const {
      data: { subscription },
    } = client.onAuthStateChange(event)
    try {
      const pending = client.getSession()
      await jest.advanceTimersByTimeAsync(10200)
      expect((await client.initialize()).error).toBeNull()
      expect((await pending).data.session?.user.id).toBe(expired.user.id)
      expect(event).toHaveBeenCalledWith(
        'TOKEN_REFRESHED',
        expect.objectContaining({
          user: expired.user,
          refresh_token: refreshed.refresh_token,
        })
      )
      expect(transport).toHaveBeenCalledTimes(2)
    } finally {
      subscription.unsubscribe()
    }
  })

  it.each(['rejected', 'stalled'] as const)(
    'preserves the saved session after exhausted %s requests, then recovers',
    async mode => {
      if (mode === 'rejected')
        transport.mockRejectedValue(new TypeError('Network unavailable'))
      else
        transport.mockImplementation(
          (_, init) =>
            new Promise((_, reject) => {
              init?.signal?.addEventListener('abort', () =>
                reject(new Error('Aborted'))
              )
            })
        )
      const pending = client.getSession()
      await jest.advanceTimersByTimeAsync(40000)
      const result = await pending
      expect(result.error?.name).toBe('AuthRetryableFetchError')
      expect(result.data.session).toBeNull()
      expect(values.get(storageKey)).toBe(JSON.stringify(expired))
      transport.mockImplementation(async () => success())
      const recovered = await client.getSession()
      expect(recovered.error).toBeNull()
      expect(recovered.data.session?.user.id).toBe(expired.user.id)
      expect(recovered.data.session?.refresh_token).toBe(
        refreshed.refresh_token
      )
    }
  )

  it('still clears a session when Auth definitively rejects its refresh token', async () => {
    transport.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'refresh_token_not_found',
          message: 'Refresh token is invalid',
        }),
        { status: 400 }
      )
    )
    const result = await client.getSession()
    expect(result.error).not.toBeNull()
    expect(result.data.session).toBeNull()
    expect(values.has(storageKey)).toBe(false)
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
