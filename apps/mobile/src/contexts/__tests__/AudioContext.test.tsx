import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio'
import { AudioProvider, useAudio } from '@/contexts/AudioContext'

const mockedUseAudioPlayer = useAudioPlayer as jest.MockedFunction<
  typeof useAudioPlayer
>
const mockedSetAudioModeAsync = setAudioModeAsync as jest.MockedFunction<
  typeof setAudioModeAsync
>

describe('AudioProvider', () => {
  let audio: ReturnType<typeof useAudio> | null
  let player: AudioPlayer

  function Probe() {
    audio = useAudio()
    return null
  }

  beforeEach(() => {
    jest.clearAllMocks()
    audio = null
    player = mockedUseAudioPlayer(null)
  })

  it('configures foreground playback and owns a single controllable player', async () => {
    render(
      <AudioProvider>
        <Probe />
      </AudioProvider>
    )

    await waitFor(() =>
      expect(mockedSetAudioModeAsync).toHaveBeenCalledWith({
        allowsRecording: false,
        interruptionMode: 'duckOthers',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      })
    )

    await act(async () => {
      await audio?.playWord('huis', 'https://audio.example/huis.mp3')
    })

    expect(player.replace).toHaveBeenCalledWith(
      'https://audio.example/huis.mp3'
    )
    expect(player.play).toHaveBeenCalledTimes(1)

    act(() => audio?.pauseAudio())
    expect(player.pause).toHaveBeenCalled()

    act(() => audio?.resumeAudio())
    expect(player.play).toHaveBeenCalledTimes(2)

    await act(async () => {
      await audio?.stopAudio()
    })
    expect(player.seekTo).toHaveBeenCalledWith(0)
  })
})
