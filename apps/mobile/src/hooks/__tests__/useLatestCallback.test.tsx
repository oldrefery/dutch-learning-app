import React, { Suspense, useLayoutEffect } from 'react'
import { Text } from 'react-native'
import { render, renderHook } from '@testing-library/react-native'
import { useLatestCallback } from '../useLatestCallback'

it('keeps identity and forwards arguments and return values to the latest commit', () => {
  const first = jest.fn((value: number) => value + 1)
  const second = jest.fn((value: number) => value + 2)
  const { result, rerender } = renderHook<
    (value: number) => number,
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
  let retained: () => string = () => 'not mounted'
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
    () => Promise<number>,
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
