import React from 'react'
import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { ConjugationSection } from '../sections/ConjugationSection'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(),
}))

it.each(['light', 'dark'] as const)(
  'uses a single conjugation table background in %s mode',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    const word = createMockWord({
      conjugation: {
        present: 'herhaal',
        simple_past: 'herhaalde',
        simple_past_plural: 'herhaalden',
        past_participle: 'herhaald',
      },
    })

    const { getByText } = await render(
      <ConjugationSection word={word} config={{ showConjugation: true }} />
    )

    for (const form of Object.values(word.conjugation ?? {})) {
      const row = getByText(form).parent
      expect(row).toBeTruthy()
      expect(
        StyleSheet.flatten(row?.props.style).backgroundColor
      ).toBeUndefined()
      expect(row?.parent).toHaveStyle({
        backgroundColor: Colors[theme].backgroundSecondary,
      })
    }
  }
)
