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
    const callback = jest.fn()
    const { result } = renderHook(() => useDebounce(callback, 500))

    act(() => {
      result.current('test')
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledWith('test')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should delay execution by specified delay', async () => {
    const callback = jest.fn()
    const delay = 1000
    const { result } = renderHook(() => useDebounce(callback, delay))

    act(() => {
      result.current('arg1')
    })

    act(() => {
      jest.advanceTimersByTime(delay - 1)
    })
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(callback).toHaveBeenCalledWith('arg1')
  })

  it('should cancel previous timeout on new call', async () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebounce(callback, 500))

    act(() => {
      result.current('first')
      jest.advanceTimersByTime(300)
      result.current('second')
      jest.advanceTimersByTime(300)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('second')
  })

  it('should only execute the latest call', async () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebounce(callback, 300))

    act(() => {
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
    const callback = jest.fn()
    const { result } = renderHook(() => useDebounce(callback, 500))

    act(() => {
      result.current('arg1', 'arg2', 'arg3')
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3')
  })

  it('should cleanup timeout on unmount', async () => {
    const callback = jest.fn()
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    const { result, unmount } = renderHook(() => useDebounce(callback, 500))

    act(() => {
      result.current('test')
    })

    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('should handle rapid successive calls', async () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current(`call-${i}`)
        jest.advanceTimersByTime(50)
      }
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('call-9')
  })

  it('should respect zero delay', async () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebounce(callback, 0))

    act(() => {
      result.current('test')
      jest.runOnlyPendingTimers()
    })

    expect(callback).toHaveBeenCalledWith('test')
  })

  it('should update delay when it changes', async () => {
    const callback = jest.fn()
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number }) => useDebounce(callback, delay),
      { initialProps: { delay: 300 } }
    )

    act(() => {
      result.current('test')
      jest.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    callback.mockClear()

    rerender({ delay: 500 })

    act(() => {
      result.current('test2')
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledWith('test2')
  })

  it('should handle empty calls', async () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current()
      jest.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalled()
  })

  describe('edge cases', () => {
    it('should handle callback changes', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      const { result, rerender } = renderHook(
        ({ callback }: { callback: (arg: string) => void }) =>
          useDebounce(callback, 100),
        { initialProps: { callback: callback1 } }
      )

      act(() => {
        result.current('test1')
      })

      rerender({ callback: callback2 })

      act(() => {
        result.current('test2')
        jest.advanceTimersByTime(100)
      })

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalledWith('test2')
    })

    it('should handle errors in callback gracefully', async () => {
      const callback = jest.fn(() => {
        throw new Error('Callback error')
      })
      const { result } = renderHook(() => useDebounce(callback, 100))

      act(() => {
        result.current('test')
      })

      expect(() => {
        act(() => {
          jest.advanceTimersByTime(100)
        })
      }).toThrow()
    })

    it('should not execute after unmount', async () => {
      const callback = jest.fn()
      const { result, unmount } = renderHook(() => useDebounce(callback, 500))

      act(() => {
        result.current('test')
      })

      unmount()

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('performance', () => {
    it('should handle large delay values', async () => {
      const callback = jest.fn()
      const { result } = renderHook(() => useDebounce(callback, 10000))

      act(() => {
        result.current('test')
        jest.advanceTimersByTime(10000)
      })

      expect(callback).toHaveBeenCalledWith('test')
    })

    it('should handle very small delay values', async () => {
      const callback = jest.fn()
      const { result } = renderHook(() => useDebounce(callback, 1))

      act(() => {
        result.current('test')
        jest.advanceTimersByTime(1)
      })

      expect(callback).toHaveBeenCalledWith('test')
    })
  })
})
