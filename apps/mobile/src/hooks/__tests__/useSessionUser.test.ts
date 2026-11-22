import { act, renderHook } from '@testing-library/react-native'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { useSessionUser } from '../useSessionUser'

jest.mock('@/lib/supabaseClient', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn(), getUser: jest.fn() } },
}))

const PRIMARY_USER_ID = 'qa-session-user'
const SECONDARY_USER_ID = 'second-user'
const session = (id = PRIMARY_USER_ID, email = 'qa@example.invalid') =>
  ({ user: { id, email } }) as Session

describe('session profile display', () => {
  let listener: (event: AuthChangeEvent, session: Session | null) => void
  const unsubscribe = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(supabase.auth.onAuthStateChange)
      .mockImplementation(callback => {
        listener = callback
        return {
          data: { subscription: { id: 'profile', callback, unsubscribe } },
        }
      })
  })

  it('displays the initial stored user without a network getUser request', async () => {
    const { result } = await renderHook(() => useSessionUser(PRIMARY_USER_ID))
    expect(result.current).toBeNull()
    await act(() => listener('INITIAL_SESSION', session()))
    expect(result.current?.email).toBe('qa@example.invalid')
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'] as const)(
    'updates displayed metadata on %s',
    async event => {
      const { result } = await renderHook(() => useSessionUser(PRIMARY_USER_ID))
      await act(() => listener('INITIAL_SESSION', session()))
      await act(() =>
        listener(event, session(PRIMARY_USER_ID, 'updated@example.invalid'))
      )
      expect(result.current?.email).toBe('updated@example.invalid')
    }
  )

  it('clears metadata on sign-out or a missing initial session', async () => {
    const { result } = await renderHook(() => useSessionUser(PRIMARY_USER_ID))
    await act(() => listener('INITIAL_SESSION', null))
    expect(result.current).toBeNull()
    await act(() => listener('SIGNED_IN', session()))
    await act(() => listener('SIGNED_OUT', null))
    expect(result.current).toBeNull()
  })

  it('never displays a different account while store identity changes', async () => {
    const { result, rerender } = await renderHook(
      ({ id }: { id: string | null }) => useSessionUser(id),
      { initialProps: { id: PRIMARY_USER_ID } }
    )
    await act(() => listener('INITIAL_SESSION', session()))
    await rerender({ id: SECONDARY_USER_ID })
    expect(result.current).toBeNull()
    await act(() => listener('SIGNED_IN', session(SECONDARY_USER_ID)))
    expect(result.current?.id).toBe(SECONDARY_USER_ID)
    await rerender({ id: null })
    expect(result.current).toBeNull()
  })

  it('unsubscribes and ignores a queued callback after unmount', async () => {
    const { result, unmount } = await renderHook(() =>
      useSessionUser(PRIMARY_USER_ID)
    )
    await act(() => listener('INITIAL_SESSION', session()))
    const displayed = result.current
    await unmount()
    await act(() => listener('SIGNED_OUT', null))
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(result.current).toBe(displayed)
  })
})
