import { act, renderHook } from '@testing-library/react'
import type { ReviewWord } from './types'
import { useAudioReviewPlayback } from './useAudioReviewPlayback'

class FakeAudio {
  static instances: FakeAudio[] = []
  static nextPlayError: Error | null = null

  currentTime = 0
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  paused = true
  pause = jest.fn(() => {
    this.paused = true
  })
  play = jest.fn(async () => {
    if (FakeAudio.nextPlayError) {
      const error = FakeAudio.nextPlayError
      FakeAudio.nextPlayError = null
      throw error
    }
    this.paused = false
  })

  constructor(readonly src: string) {
    FakeAudio.instances.push(this)
  }
}

class FakeSpeechSynthesisUtterance {
  lang = ''
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(readonly text: string) {}
}

const speechSynthesis = {
  cancel: jest.fn(),
  pause: jest.fn(),
  paused: false,
  resume: jest.fn(),
  speak: jest.fn((utterance: FakeSpeechSynthesisUtterance): void => {
    void utterance
  }),
}

const makeWord = (ttsUrl: string | null): ReviewWord => ({
  article: 'het',
  collectionId: 'collection-1',
  dutchLemma: 'huis',
  dutchOriginal: 'het huis',
  easinessFactor: 2.5,
  id: 'word-1',
  imageUrl: null,
  intervalDays: 0,
  lastReviewedAt: null,
  nextReviewDate: '2020-01-01',
  partOfSpeech: 'noun',
  repetitionCount: 0,
  translations: { en: ['house'] },
  ttsUrl,
})

describe('useAudioReviewPlayback', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      value: FakeAudio,
    })
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: FakeSpeechSynthesisUtterance,
    })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: speechSynthesis,
    })
  })

  beforeEach(() => {
    FakeAudio.instances = []
    FakeAudio.nextPlayError = null
    jest.clearAllMocks()
    speechSynthesis.paused = false
  })

  test('plays, pauses, resumes, and stops recorded audio', async () => {
    const { result } = renderHook(() => useAudioReviewPlayback())

    await act(async () => result.current.play(makeWord('/huis.mp3')))
    const audio = FakeAudio.instances[0]
    if (!audio) throw new Error('Expected an audio instance')

    expect(audio.src).toBe('/huis.mp3')
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(result.current.isPlaying).toBe(true)

    act(() => result.current.togglePause())
    expect(audio.pause).toHaveBeenCalledTimes(1)
    expect(result.current.isPaused).toBe(true)

    await act(async () => {
      result.current.togglePause()
      await Promise.resolve()
    })
    expect(audio.play).toHaveBeenCalledTimes(2)
    expect(result.current.isPlaying).toBe(true)

    act(() => result.current.stop())
    expect(audio.currentTime).toBe(0)
    expect(result.current.isPlaying).toBe(false)
  })

  test('uses Dutch speech synthesis when recorded audio is unavailable', async () => {
    const { result } = renderHook(() => useAudioReviewPlayback())

    await act(async () => result.current.play(makeWord(null)))

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
    const utterance = speechSynthesis.speak.mock.calls[0][0]
    expect(utterance).toMatchObject({ text: 'huis', lang: 'nl-NL' })
    expect(result.current.isPlaying).toBe(true)
    const handleEnd = utterance.onend
    if (!handleEnd) throw new Error('Expected a speech completion handler')

    act(() => handleEnd())
    expect(result.current.isPlaying).toBe(false)
  })

  test('falls back to speech when recorded playback rejects', async () => {
    FakeAudio.nextPlayError = new Error('Blocked')
    const { result } = renderHook(() => useAudioReviewPlayback())

    await act(async () => result.current.play(makeWord('/huis.mp3')))

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
    expect(result.current.isPlaying).toBe(true)
  })
})
