import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { ActionsSection } from '../sections/ActionsSection'
import { HeaderSection } from '../sections/HeaderSection'
import { ImageSection } from '../sections/ImageSection'
import type { WordCardConfig } from '../types'

jest.mock('@/components/CopyButton', () => ({ CopyButton: () => null }))
jest.mock('@/components/DictionaryConflictResolver', () => ({
  DictionaryConflictResolver: () => null,
}))
jest.mock('@/components/DictionaryImportConflictResolver', () => ({
  DictionaryImportConflictResolver: () => null,
}))
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))
jest.mock('@/components/glass/buttons', () => ({
  GlassCapsuleButton: ({
    text,
    onPress,
  }: {
    text: string
    onPress: () => void
  }) => {
    const mockReact = jest.requireActual<typeof import('react')>('react')
    const { TouchableOpacity, Text } =
      jest.requireActual<typeof import('react-native')>('react-native')
    return mockReact.createElement(
      TouchableOpacity,
      { onPress },
      mockReact.createElement(Text, {}, text)
    )
  },
}))
const defaultConfig: WordCardConfig = {
  showHeader: true,
  showTranslations: true,
  showExamples: true,
  showImage: true,
  showSynonyms: true,
  showAntonyms: true,
  showGrammarInfo: true,
  showConjugation: true,
  showNotes: true,
  showUsageNotes: true,
  enablePronunciation: true,
  enableImageChange: true,
  scrollable: true,
  compact: false,
  extraHeightAddWord: 0,
}
const sharedWord = createMockWord({
  image_url: 'https://example.test/shared.jpg',
  dictionary_content_state: {
    protocol_version: 2,
    mode: 'follow',
    content_version: '9007199254740992',
    reference: { entry_id: 'entry', revision_id: 'revision' },
    adopted_revision_id: 'revision',
    head_sequence: '9007199254740993',
    watermark: '9007199254740993',
  },
})

describe.each(['light', 'dark'] as const)('%s following actions', theme => {
  beforeEach(() => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
  })

  it('uses the card background for all learning statistics', async () => {
    const { getByText } = await render(
      <ActionsSection
        word={createMockWord({ easiness_factor: 2.5 })}
        actions={{ showProgressInfo: true, showStatusInfo: true }}
      />
    )

    for (const label of ['Reviews:', 'Ease Factor:', 'Next Review:']) {
      const row = getByText(label).parent
      expect(row).toBeTruthy()
      expect(
        StyleSheet.flatten(row?.props.style).backgroundColor
      ).toBeUndefined()
      expect(row?.parent).toHaveStyle({
        backgroundColor: Colors[theme].backgroundSecondary,
      })
    }
  })

  it('hides private reanalysis and image changes while keeping learning and the shared image visible', async () => {
    const onReanalyze = jest.fn()
    const onChangeImage = jest.fn()
    const actions = await render(
      <ActionsSection
        word={sharedWord}
        actions={{
          showReanalyzeButton: true,
          onReanalyze,
          showProgressInfo: true,
        }}
      />
    )
    expect(actions.queryByText('Re-analyze Word')).toBeNull()
    expect(actions.getByText('Reviews:')).toBeTruthy()
    const image = await render(
      <ImageSection
        word={sharedWord}
        config={{ ...defaultConfig, enableImageChange: true }}
        onChangeImage={onChangeImage}
      />
    )
    expect(image.queryByText('Change Image')).toBeNull()
    expect(image.getByText(/Visual/)).toBeTruthy()
    expect(onReanalyze).not.toHaveBeenCalled()
    expect(onChangeImage).not.toHaveBeenCalled()
  })
  it('retains existing private actions for legacy words', async () => {
    const word = { ...sharedWord, dictionary_content_state: undefined }
    const onReanalyze = jest.fn()
    const onChangeImage = jest.fn()
    const actions = await render(
      <ActionsSection
        word={word}
        actions={{ showReanalyzeButton: true, onReanalyze }}
      />
    )
    await fireEvent.press(actions.getByText('Re-analyze Word'))
    expect(onReanalyze).toHaveBeenCalledTimes(1)
    const image = await render(
      <ImageSection
        word={word}
        config={{ ...defaultConfig, enableImageChange: true }}
        onChangeImage={onChangeImage}
      />
    )
    await fireEvent.press(image.getByText('Change Image'))
    expect(onChangeImage).toHaveBeenCalledTimes(1)
  })
})

it.each([
  ['december', false],
  ['dinsdag', false],
  ['stad', true],
] as const)(
  'shows the article badge for an analysis of %s only when appropriate',
  async (lemma, showsArticle) => {
    const word = {
      dutch_lemma: lemma,
      part_of_speech: 'noun',
      article: 'de' as const,
      is_irregular: false,
      translations: { en: [lemma] },
      examples: [],
    }
    const { getByText, queryByText } = await render(
      <HeaderSection
        word={word}
        config={defaultConfig}
        metadata={{ source: 'cache' }}
      />
    )
    expect(getByText('noun')).toBeTruthy()
    expect(Boolean(queryByText('de'))).toBe(showsArticle)
  }
)
