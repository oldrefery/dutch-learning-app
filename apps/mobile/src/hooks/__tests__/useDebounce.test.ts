/**
 * Unit tests for useDebounce hook
 * Tests debouncing functionality with custom delay
 */

import { renderHook, act } from '@testing-library/react-native'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should debounce callback execution', async () => {
    const callback = jest.fn<void, [string]>()
    const { result } = await renderHook(() => useDebounce(callback, 500))

    await act(() => {
      result.current('test')
    })

    expect(callback).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledWith('test')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should delay execution by specified delay', async () => {
    const callback = jest.fn<void, [string]>()
    const delay = 1000
    const { result } = await renderHook(() => useDebounce(callback, delay))

    await act(() => {
      result.current('arg1')
    })

    await act(() => {
      jest.advanceTimersByTime(delay - 1)
    })
    expect(callback).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(callback).toHaveBeenCalledWith('arg1')
  })

  it('should cancel previous timeout on new call', async () => {
    const callback = jest.fn<void, [string]>()
    const { result } = await renderHook(() => useDebounce(callback, 500))

    await act(() => {
      result.current('first')
      jest.advanceTimersByTime(300)
      result.current('second')
      jest.advanceTimersByTime(300)
    })

    expect(callback).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('second')
  })

  it('should only execute the latest call', async () => {
    const callback = jest.fn<void, [string]>()
    const { result } = await renderHook(() => useDebounce(callback, 300))

    await act(() => {
      result.current('arg1')
      jest.advanceTimersByTime(100)
      result.current('arg2')
      jest.advanceTimersByTime(100)
      result.current('arg3')
      jest.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('arg3')
  })

  it('should handle multiple arguments', async () => {
    const callback = jest.fn<void, [string, string, string]>()
    const { result } = await renderHook(() => useDebounce(callback, 500))

    await act(() => {
      result.current('arg1', 'arg2', 'arg3')
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3')
  })

  it('should cleanup timeout on unmount', async () => {
    const callback = jest.fn<void, [string]>()
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    const { result, unmount } = await renderHook(() =>
      useDebounce(callback, 500)
    )

    await act(() => {
      result.current('test')
    })

    await unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('should handle rapid successive calls', async () => {
    const callback = jest.fn<void, [string]>()
    const { result } = await renderHook(() => useDebounce(callback, 100))

    await act(() => {
      for (let i = 0; i < 10; i++) {
        result.current(`call-${i}`)
        jest.advanceTimersByTime(50)
      }
    })

    expect(callback).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('call-9')
  })

  it('should respect zero delay', async () => {
    const callback = jest.fn<void, [string]>()
    const { result } = await renderHook(() => useDebounce(callback, 0))

    await act(() => {
      result.current('test')
      jest.runOnlyPendingTimers()
    })

    expect(callback).toHaveBeenCalledWith('test')
  })

  it('should update delay when it changes', async () => {
    const callback = jest.fn<void, [string]>()
    const { result, rerender } = await renderHook(
      ({ delay }: { delay: number }) => useDebounce(callback, delay),
      { initialProps: { delay: 300 } }
    )

    await act(() => {
      result.current('test')
      jest.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    callback.mockClear()

    await rerender({ delay: 500 })

    await act(() => {
      result.current('test2')
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledWith('test2')
  })

  it('should handle empty calls', async () => {
    const callback = jest.fn<void, []>()
    const { result } = await renderHook(() => useDebounce(callback, 100))

    await act(() => {
      result.current()
      jest.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalled()
  })

  describe('edge cases', () => {
    it('should handle callback changes', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      const { result, rerender } = await renderHook(
        ({ callback }: { callback: (arg: string) => void }) =>
          useDebounce(callback, 100),
        { initialProps: { callback: callback1 } }
      )

      await act(() => {
        result.current('test1')
      })

      await rerender({ callback: callback2 })

      await act(() => {
        result.current('test2')
        jest.advanceTimersByTime(100)
      })

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalledWith('test2')
    })

    it('should handle errors in callback gracefully', async () => {
      const callback = jest.fn<void, [string]>(() => {
        throw new Error('Callback error')
      })
      const { result } = await renderHook(() => useDebounce(callback, 100))

      await act(() => {
        result.current('test')
      })

      await expect(async () => {
        await act(() => jest.advanceTimersByTime(100))
      }).rejects.toThrow('Callback error')
    })

    it('should not execute after unmount', async () => {
      const callback = jest.fn<void, [string]>()
      const { result, unmount } = await renderHook(() =>
        useDebounce(callback, 500)
      )

      await act(() => {
        result.current('test')
      })

      await unmount()

      await act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('performance', () => {
    it('should handle large delay values', async () => {
      const callback = jest.fn<void, [string]>()
      const { result } = await renderHook(() => useDebounce(callback, 10000))

      await act(() => {
        result.current('test')
        jest.advanceTimersByTime(10000)
      })

      expect(callback).toHaveBeenCalledWith('test')
    })

    it('should handle very small delay values', async () => {
      const callback = jest.fn<void, [string]>()
      const { result } = await renderHook(() => useDebounce(callback, 1))

      await act(() => {
        result.current('test')
        jest.advanceTimersByTime(1)
      })

      expect(callback).toHaveBeenCalledWith('test')
    })
  })
})
