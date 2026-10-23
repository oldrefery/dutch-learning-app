import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { ActionsSection } from '../sections/ActionsSection'
import { ImageSection } from '../sections/ImageSection'
import type { WordCardConfig } from '../types'

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
  it('hides private reanalysis and image changes while keeping learning and the shared image visible', () => {
    const onReanalyze = jest.fn()
    const onChangeImage = jest.fn()
    const actions = render(
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
    const image = render(
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
  it('retains existing private actions for legacy words', () => {
    const word = { ...sharedWord, dictionary_content_state: undefined }
    const onReanalyze = jest.fn()
    const onChangeImage = jest.fn()
    const actions = render(
      <ActionsSection
        word={word}
        actions={{ showReanalyzeButton: true, onReanalyze }}
      />
    )
    fireEvent.press(actions.getByText('Re-analyze Word'))
    expect(onReanalyze).toHaveBeenCalledTimes(1)
    const image = render(
      <ImageSection
        word={word}
        config={{ ...defaultConfig, enableImageChange: true }}
        onChangeImage={onChangeImage}
      />
    )
    fireEvent.press(image.getByText('Change Image'))
    expect(onChangeImage).toHaveBeenCalledTimes(1)
  })
})
