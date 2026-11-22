import React from 'react'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { act, fireEvent, render } from '@testing-library/react-native'
import CollectionContent from '@/components/CollectionContent'
import { createMockWord } from '@/__tests__/helpers/factories'
import { SEARCH_DEBOUNCE_DELAY } from '@/constants/UIConstants'
import type { Word } from '@/types/database'

jest.mock('@/hooks/useNormalizedColorScheme')
jest.mock('@/components/SwipeableWordItem', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {
    __esModule: true,
    default: ({ word }: { word: Word }) => <Text>{word.dutch_lemma}</Text>,
  }
})

it.each(['light', 'dark'] as const)(
  'preserves pending search across refresh and finds the final word among 5000 in %s mode',
  async theme => {
    jest.useFakeTimers()
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    try {
      const words = Array.from({ length: 5000 }, (_, index) =>
        createMockWord({
          word_id: `word-${index}`,
          dutch_lemma: `woord${index}`,
        })
      )
      const props = {
        words,
        stats: {
          totalWords: 5000,
          masteredWords: 0,
          wordsForReview: 5000,
          newWords: 5000,
        },
        refreshing: false,
        onRefresh: jest.fn(),
        onWordPress: jest.fn(),
        onDeleteWord: jest.fn(),
        onStartReview: jest.fn(),
      }
      const screen = await render(<CollectionContent {...props} />)
      await fireEvent.changeText(
        screen.getByPlaceholderText('Search Dutch words...'),
        'woord4999'
      )
      await screen.rerender(<CollectionContent {...props} refreshing />)
      expect(
        screen.getByPlaceholderText('Search Dutch words...').props.value
      ).toBe('woord4999')
      await act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_DELAY))
      expect(screen.getByText('woord4999')).toBeTruthy()
      expect(screen.queryByText('woord0')).toBeNull()
      await fireEvent.press(screen.getByText('Review 5000 Words'))
      expect(props.onStartReview).toHaveBeenCalledTimes(1)
      await screen.unmount()
    } finally {
      jest.useRealTimers()
    }
  }
)
