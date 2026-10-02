import { act, renderHook } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useTransferSession } from './useTransferSession'
import { OWNER, OTHER_OWNER } from './__fixtures__/dictionary-transfer'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
type AuthCallback = (
  event: string,
  session: { user: { id: string } } | null
) => void
const callbacks: AuthCallback[] = []
const unsubscribe = jest.fn()
let initialOwner = OWNER
beforeEach(() => {
  initialOwner = OWNER
  callbacks.length = 0
  jest.clearAllMocks()
  jest.mocked(createClient).mockReturnValue({
    auth: {
      onAuthStateChange: (callback: AuthCallback) => {
        callbacks.push(callback)
        callback('INITIAL_SESSION', { user: { id: initialOwner } })
        return { data: { subscription: { unsubscribe } } }
      },
    },
  } as never)
})
it('allows normal same-owner token refreshes without invalidating an operation', () => {
  const { result } = renderHook(() => useTransferSession(OWNER))
  const ticket = result.current.capture()
  expect(ticket).not.toBeNull()
  act(() => callbacks[0]('TOKEN_REFRESHED', { user: { id: OWNER } }))
  expect(result.current.isCurrent(ticket!)).toBe(true)
})
it.each(['SIGNED_OUT', 'different-owner'])(
  'invalidates stale operations permanently, including sign-back owner ABA: %s',
  event => {
    const { result } = renderHook(() => useTransferSession(OWNER))
    const ticket = result.current.capture()!
    act(() =>
      callbacks[0](
        event === 'SIGNED_OUT' ? event : 'SIGNED_IN',
        event === 'SIGNED_OUT' ? null : { user: { id: OTHER_OWNER } }
      )
    )
    act(() => callbacks[0]('SIGNED_IN', { user: { id: OWNER } }))
    expect(result.current.active).toBe(false)
    expect(result.current.capture()).toBeNull()
    expect(result.current.isCurrent(ticket)).toBe(false)
  }
)
it('does not revive an old subscription callback after a new effect lifetime', () => {
  const { result, rerender, unmount } = renderHook(
    ({ owner }) => useTransferSession(owner),
    { initialProps: { owner: OWNER } }
  )
  const ticket = result.current.capture()!
  initialOwner = OTHER_OWNER
  rerender({ owner: OTHER_OWNER })
  act(() => callbacks[1]('SIGNED_IN', { user: { id: OTHER_OWNER } }))
  // A late callback from the old subscription must not touch the new lifetime.
  act(() => callbacks[0]('SIGNED_OUT', null))
  expect(result.current.active).toBe(true)
  expect(result.current.isCurrent(ticket)).toBe(false)
  unmount()
  expect(unsubscribe).toHaveBeenCalledTimes(2)
})
