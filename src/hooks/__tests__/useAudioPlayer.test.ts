/**
 * Tests for useAudioPlayer hook
 *
 * Thin wrapper around AudioContext's useAudio.
 * Handles custom URL, fallback TTS URL, and exposes isPlaying/isReady.
 */

import { renderHook, act } from '@testing-library/react-native'
import { useAudioPlayer } from '../useAudioPlayer'
import { useAudio } from '@/contexts/AudioContext'

jest.mock('@/contexts/AudioContext')

describe('useAudioPlayer', () => {
  const mockPlayWord = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockPlayWord.mockResolvedValue(undefined)
    ;(useAudio as jest.Mock).mockReturnValue({
      playWord: mockPlayWord,
      isPlaying: false,
    })
  })

  it('should return isReady as true always', () => {
    const { result } = renderHook(() => useAudioPlayer())

    expect(result.current.isReady).toBe(true)
  })

  it('should return isPlaying from context', () => {
    ;(useAudio as jest.Mock).mockReturnValue({
      playWord: mockPlayWord,
      isPlaying: true,
    })

    const { result } = renderHook(() => useAudioPlayer())

    expect(result.current.isPlaying).toBe(true)
  })

  it('should call playWord with custom URL when provided', async () => {
    const { result } = renderHook(() => useAudioPlayer())

    await act(async () => {
      await result.current.playAudio(
        'https://custom.audio/word.mp3',
        'huis',
        null
      )
    })

    expect(mockPlayWord).toHaveBeenCalledWith(
      'huis',
      'https://custom.audio/word.mp3'
    )
  })

  it('should call playWord with ttsUrl when no custom URL', async () => {
    const { result } = renderHook(() => useAudioPlayer())

    await act(async () => {
      await result.current.playAudio(
        undefined,
        'huis',
        'https://tts.audio/huis.mp3'
      )
    })

    expect(mockPlayWord).toHaveBeenCalledWith(
      'huis',
      'https://tts.audio/huis.mp3'
    )
  })

  it('should do nothing when fallbackWord is falsy', async () => {
    const { result } = renderHook(() => useAudioPlayer())

    await act(async () => {
      await result.current.playAudio('https://audio.mp3', '', null)
    })

    expect(mockPlayWord).not.toHaveBeenCalled()
  })
})
