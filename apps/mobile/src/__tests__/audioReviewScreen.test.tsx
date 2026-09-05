import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import AudioReviewScreen from '@/app/audio-review'
import { ROUTES } from '@/constants/Routes'
import { useAudioReviewSession } from '@/hooks/useAudioReviewSession'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

const mockReplace = jest.fn()

jest.mock('@/hooks/useAudioReviewSession')
jest.mock('@/hooks/useNormalizedColorScheme')
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 24, left: 0 }),
}))

const mockSession = jest.mocked(useAudioReviewSession)
const mockColorScheme = jest.mocked(useNormalizedColorScheme)
const exitSession = jest.fn().mockResolvedValue(undefined)
const EXIT_LABEL = 'Exit Audio Review'

describe.each(['light', 'dark'] as const)(
  'Audio Review %s end states',
  theme => {
    beforeEach(() => {
      jest.clearAllMocks()
      mockColorScheme.mockReturnValue(theme)
      jest.mocked(useRouter).mockReturnValue({
        ...useRouter(),
        replace: mockReplace,
      })
    })

    it.each([
      { complete: false, title: 'Nothing Due' },
      { complete: true, title: 'Audio Review Complete' },
    ])('keeps the $title exit button compact and functional', async state => {
      mockSession.mockReturnValue({
        currentWord: null,
        preferredTranslation: null,
        currentWordNumber: 1,
        totalWords: 0,
        isRevealed: false,
        isPlaying: false,
        isStarting: false,
        isPaused: false,
        isAssessing: false,
        sessionEmpty: !state.complete,
        sessionComplete: state.complete,
        revealAnswer: jest.fn().mockResolvedValue(undefined),
        replayPrompt: jest.fn().mockResolvedValue(undefined),
        togglePause: jest.fn(),
        submitAgain: jest.fn().mockResolvedValue(undefined),
        submitGood: jest.fn().mockResolvedValue(undefined),
        exitSession,
      })

      const screen = render(<AudioReviewScreen />)
      expect(screen.getByText(state.title)).toBeVisible()
      const exitButton = screen.getByRole('button', { name: EXIT_LABEL })
      expect(exitButton).toHaveStyle({ flex: 0, minHeight: 52 })

      await act(async () => {
        fireEvent.press(exitButton)
      })

      expect(exitSession).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith(ROUTES.TABS.REVIEW)
    })
  }
)
