import React, { Suspense, useLayoutEffect } from 'react'
import { Text } from 'react-native'
import { act, render, renderHook } from '@testing-library/react-native'
import { useLatestCallback } from '../useLatestCallback'

it('keeps identity and forwards arguments and return values to the latest commit', () => {
  const first = jest.fn((value: number) => value + 1)
  const second = jest.fn((value: number) => value + 2)
  const { result, rerender } = renderHook<
    (value: number) => number | undefined,
    { callback: (value: number) => number }
  >(({ callback }) => useLatestCallback(callback), {
    initialProps: { callback: first },
  })
  const retained = result.current
  expect(retained(2)).toBe(3)
  rerender({ callback: second })
  expect(result.current).toBe(retained)
  expect(retained(2)).toBe(4)
  expect(second).toHaveBeenCalledWith(2)
})

it('does not expose a handler from a suspended, uncommitted render', () => {
  const never = new Promise<void>(() => {})
  let retained: () => string | undefined = () => 'not mounted'
  const first = () => 'committed'
  const next = () => 'next'
  function Child({
    callback,
    suspend,
  }: {
    callback: () => string
    suspend: boolean
  }) {
    const stable = useLatestCallback(callback)
    useLayoutEffect(() => {
      retained = stable
    }, [stable])
    if (suspend) throw never
    return <Text>Ready</Text>
  }
  const tree = (callback: () => string, suspend: boolean) => (
    <Suspense fallback={<Text>Waiting</Text>}>
      <Child callback={callback} suspend={suspend} />
    </Suspense>
  )
  const { rerender } = render(tree(first, false))
  const original = retained
  rerender(tree(next, true))
  expect(original()).toBe('committed')
  rerender(tree(next, false))
  expect(retained).toBe(original)
  expect(original()).toBe('next')
})

it('preserves async return values and failures', async () => {
  const failure = new Error('Synthetic action failure')
  const { result, rerender } = renderHook<
    () => Promise<number> | undefined,
    { callback: () => Promise<number> }
  >(({ callback }) => useLatestCallback(callback), {
    initialProps: { callback: async () => 1 },
  })
  const retained = result.current
  await expect(retained()).resolves.toBe(1)
  rerender({
    callback: async () => {
      throw failure
    },
  })
  await expect(retained()).rejects.toBe(failure)
})

it('releases the target and ignores a retained callback after unmount', () => {
  const callback = jest.fn(() => 'completed')
  const { result, unmount } = renderHook(() => useLatestCallback(callback))
  const retained = result.current
  unmount()
  expect(retained()).toBeUndefined()
  expect(callback).not.toHaveBeenCalled()
})

it('preserves already-started work but does not start work after unmount', async () => {
  let complete: (value: number) => void = () => {}
  const pending = new Promise<number>(resolve => {
    complete = resolve
  })
  const callback = jest.fn(() => pending)
  const { result, unmount } = renderHook(() => useLatestCallback(callback))
  const retained = result.current
  const started = retained()
  unmount()
  complete(7)
  await expect(started).resolves.toBe(7)
  expect(retained()).toBeUndefined()
  expect(callback).toHaveBeenCalledTimes(1)
})

it('restores the committed target after effect cleanup and reactivation', () => {
  const callback = jest.fn(() => 9)
  const layouts: React.EffectCallback[] = []
  const passives: React.EffectCallback[] = []
  const cleanups: (() => void)[] = []
  const originalLayout = React.useLayoutEffect
  const originalPassive = React.useEffect
  const layoutSpy = jest
    .spyOn(React, 'useLayoutEffect')
    .mockImplementation((setup, deps) => {
      layouts.push(setup)
      originalLayout(setup, deps)
    })
  const passiveSpy = jest
    .spyOn(React, 'useEffect')
    .mockImplementation((setup, deps) => {
      passives.push(setup)
      originalPassive(() => {
        const cleanup = setup()
        if (cleanup) cleanups.push(cleanup)
        return cleanup
      }, deps)
    })
  try {
    const { result, unmount } = renderHook(() => useLatestCallback(callback), {
      wrapper: ({ children }) => (
        <React.StrictMode>{children}</React.StrictMode>
      ),
    })
    const retained = result.current
    expect(cleanups.length).toBeGreaterThan(0)
    act(() => {
      cleanups.forEach(cleanup => cleanup())
    })
    expect(retained()).toBeUndefined()
    expect(callback).not.toHaveBeenCalled()
    act(() => {
      layouts.forEach(setup => setup())
      passives.forEach(setup => setup())
    })
    expect(result.current).toBe(retained)
    expect(retained()).toBe(9)
    expect(callback).toHaveBeenCalledTimes(1)
    unmount()
  } finally {
    layoutSpy.mockRestore()
    passiveSpy.mockRestore()
  }
})
