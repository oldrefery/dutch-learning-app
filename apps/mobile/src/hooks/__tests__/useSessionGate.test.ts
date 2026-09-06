import { act, renderHook, cleanup } from '@testing-library/react-native'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { subscribeToNetworkChanges } from '@/utils/network'
import { SESSION_CHECK_TIMEOUT_MS, useSessionGate } from '../useSessionGate'

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}))
jest.mock('@/utils/network', () => ({ subscribeToNetworkChanges: jest.fn() }))

const session = { user: { id: 'qa-gate-user' } } as Session
const success = { data: { session }, error: null }
const absent = { data: { session: null }, error: null }
const unavailable = { data: { session: null }, error: new Error('Offline') }

describe('session routing gate', () => {
  let auth: (event: AuthChangeEvent, session: Session | null) => void
  let network: (connected: boolean) => void
  const unsubscribe = jest.fn()
  const unsubscribeNetwork = jest.fn()
  const getSession = jest.mocked(supabase.auth.getSession)

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    getSession.mockReset().mockResolvedValue(absent)
    jest
      .mocked(supabase.auth.onAuthStateChange)
      .mockImplementation(callback => {
        auth = callback
        return { data: { subscription: { id: 'gate', callback, unsubscribe } } }
      })
    jest.mocked(subscribeToNetworkChanges).mockImplementation(callback => {
      network = callback
      return unsubscribeNetwork
    })
  })

  afterEach(() => {
    cleanup()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  const settle = async () => {
    await act(async () => {})
  }

  it('opens a stored session without waiting for network authorization', async () => {
    getSession.mockResolvedValue(success)
    const { result } = renderHook(useSessionGate)
    await settle()
    expect(result.current).toMatchObject({
      status: 'signed-in',
      userId: session.user.id,
    })
  })

  it('routes a confirmed missing session to sign-in', async () => {
    const { result } = renderHook(useSessionGate)
    await settle()
    expect(result.current.status).toBe('signed-out')
  })

  it.each(['resolved', 'rejected'] as const)(
    'does not mistake a %s network failure for logout',
    async mode => {
      if (mode === 'resolved')
        getSession.mockResolvedValue(
          unavailable as Awaited<ReturnType<typeof supabase.auth.getSession>>
        )
      else getSession.mockRejectedValue(new Error('Offline'))
      const { result } = renderHook(useSessionGate)
      await settle()
      act(() => auth('INITIAL_SESSION', null))
      expect(result.current.status).toBe('unavailable')
      getSession.mockResolvedValue(success)
      act(() => {
        network(false)
        network(true)
      })
      await settle()
      expect(result.current.status).toBe('signed-in')
    }
  )

  it('bounds loading without cancelling or multiplying a pending SDK refresh', async () => {
    let finish: (value: typeof success) => void = () => {}
    getSession.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const { result } = renderHook(useSessionGate)
    act(() => auth('INITIAL_SESSION', null))
    act(() => jest.advanceTimersByTime(SESSION_CHECK_TIMEOUT_MS - 1))
    expect(result.current.status).toBe('checking')
    act(() => jest.advanceTimersByTime(1))
    expect(result.current.status).toBe('unavailable')
    act(() => result.current.retry())
    expect(getSession).toHaveBeenCalledTimes(1)
    act(() => jest.advanceTimersByTime(SESSION_CHECK_TIMEOUT_MS))
    expect(result.current.status).toBe('unavailable')
    await act(async () => finish(success))
    expect(result.current.status).toBe('signed-in')
  })

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'] as const)(
    'ignores old session results after %s',
    async event => {
      let finish: (value: typeof success) => void = () => {}
      getSession.mockImplementation(
        () =>
          new Promise(resolve => {
            finish = resolve
          })
      )
      const { result } = renderHook(useSessionGate)
      act(() =>
        auth(
          event,
          event === 'SIGNED_OUT'
            ? null
            : { ...session, user: { ...session.user, id: 'new-user' } }
        )
      )
      await act(async () => finish(success))
      expect(result.current).toMatchObject(
        event === 'SIGNED_OUT'
          ? { status: 'signed-out', userId: null }
          : { status: 'signed-in', userId: 'new-user' }
      )
      act(() => jest.advanceTimersByTime(SESSION_CHECK_TIMEOUT_MS))
      expect(result.current.status).not.toBe('unavailable')
    }
  )

  it('does not unmount an admitted screen on ordinary reconnection', async () => {
    getSession.mockResolvedValue(success)
    const { result } = renderHook(useSessionGate)
    await settle()
    act(() => {
      network(false)
      network(true)
      network(true)
    })
    expect(result.current.status).toBe('signed-in')
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('cleans up and ignores callbacks or rejections after unmount', async () => {
    const scheduled = jest.spyOn(global, 'setTimeout')
    const cleared = jest.spyOn(global, 'clearTimeout')
    let reject: (error: Error) => void = () => {}
    getSession.mockImplementation(
      () =>
        new Promise((_, failure) => {
          reject = failure
        })
    )
    const { result, unmount } = renderHook(useSessionGate)
    unmount()
    await act(async () => {
      reject(new Error('Late failure'))
      auth('SIGNED_IN', session)
      network(false)
      network(true)
      result.current.retry()
    })
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(unsubscribeNetwork).toHaveBeenCalledTimes(1)
    const timeoutIndex = scheduled.mock.calls.findIndex(
      ([, delay]) => delay === SESSION_CHECK_TIMEOUT_MS
    )
    expect(timeoutIndex).toBeGreaterThanOrEqual(0)
    expect(cleared).toHaveBeenCalledWith(
      scheduled.mock.results[timeoutIndex].value
    )
    expect(getSession).toHaveBeenCalledTimes(1)
    scheduled.mockRestore()
    cleared.mockRestore()
  })
})
