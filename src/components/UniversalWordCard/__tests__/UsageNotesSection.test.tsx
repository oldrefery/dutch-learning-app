import React from 'react'
import { render } from '@testing-library/react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { UniversalWordCard, WordCardPresets } from '../UniversalWordCard'

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn(),
}))

jest.mock('@/components/glass/buttons/GlassIconButton', () => ({
  GlassIconButton: () => null,
}))

jest.mock('@/components/CopyButton', () => ({
  CopyButton: () => null,
}))

jest.mock('@/components/SelectableText', () => ({
  SelectableText: ({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) => {
    const mockReact = jest.requireActual<typeof import('react')>('react')
    const { Text: MockText } =
      jest.requireActual<typeof import('react-native')>('react-native')
    return mockReact.createElement(MockText, props, children)
  },
}))

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

const mockUseNormalizedColorScheme =
  useNormalizedColorScheme as jest.MockedFunction<
    typeof useNormalizedColorScheme
  >

const usageNotes = {
  summary:
    'Woning is common in formal descriptions of housing; huis is more conversational.',
  contrasts: [
    {
      term: 'huis',
      distinction: 'The everyday word for a house or home.',
      example: {
        nl: 'We wonen in een klein huis.',
        en: 'We live in a small house.',
        ru: 'Мы живём в маленьком доме.',
      },
    },
    {
      term: 'thuis',
      distinction: 'Describes being at home, not the physical dwelling.',
    },
  ],
}

const word = createMockWord({ usage_notes: usageNotes })

describe.each(['light', 'dark'] as const)(
  '%s Usage & Nuance rendering',
  theme => {
    beforeEach(() => {
      mockUseNormalizedColorScheme.mockReturnValue(theme)
    })

    it.each([
      ['review', WordCardPresets.review.config],
      ['Word Detail', WordCardPresets.modal.config],
    ])('renders structured guidance in %s', (_surface, config) => {
      const result = render(<UniversalWordCard word={word} config={config} />)

      expect(result.getByTestId('usage-nuance-section')).toBeTruthy()
      expect(result.getByText('AI-generated guidance')).toBeTruthy()
      expect(result.getByText(usageNotes.summary)).toBeTruthy()
      expect(result.getByText('huis')).toBeTruthy()
      expect(result.getByText('🇷🇺 Мы живём в маленьком доме.')).toBeTruthy()
      expect(result.toJSON()).toMatchSnapshot()
    })
  }
)

it('hides the section for legacy words without usage notes', () => {
  const result = render(
    <UniversalWordCard
      word={createMockWord({ usage_notes: null })}
      config={WordCardPresets.modal.config}
    />
  )

  expect(result.queryByTestId('usage-nuance-section')).toBeNull()
})

it('renders a long summary and no contrast cards', () => {
  const summary = 'Use this form in context. '.repeat(12).trim()
  const result = render(
    <UniversalWordCard
      word={createMockWord({
        usage_notes: { summary, contrasts: [] },
      })}
      config={WordCardPresets.review.config}
    />
  )

  expect(result.getByText(summary)).toBeTruthy()
  expect(result.queryByText('huis')).toBeNull()
})

it('omits a missing Russian example translation', () => {
  const result = render(
    <UniversalWordCard
      word={createMockWord({
        usage_notes: {
          summary: 'A concise summary.',
          contrasts: [
            {
              term: 'gebouw',
              distinction: 'A general word for a building.',
              example: {
                nl: 'Dat gebouw is nieuw.',
                en: 'That building is new.',
              },
            },
          ],
        },
      })}
      config={WordCardPresets.modal.config}
    />
  )

  expect(result.getByText('🇬🇧 That building is new.')).toBeTruthy()
  expect(result.queryByText(/🇷🇺/)).toBeNull()
})
