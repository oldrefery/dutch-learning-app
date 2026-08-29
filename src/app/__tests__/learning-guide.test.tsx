import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import LearningGuideScreen from '../learning-guide'
import { LEARNING_GUIDE_VERSION } from '@/components/LearningGuide'
import { useSettingsStore } from '@/stores/useSettingsStore'

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<
  typeof useLocalSearchParams
>

describe('LearningGuideScreen', () => {
  const originalE2ETestMode = process.env.EXPO_PUBLIC_E2E_TEST_MODE
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
    canDismiss: jest.fn(),
    canGoBack: jest.fn(),
    setParams: jest.fn(),
    reload: jest.fn(),
    prefetch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(router)
    mockUseLocalSearchParams.mockReturnValue({})
    useSettingsStore.setState({ learningGuideVersionSeen: 0 })
    delete process.env.EXPO_PUBLIC_E2E_TEST_MODE
  })

  afterAll(() => {
    if (originalE2ETestMode === undefined) {
      delete process.env.EXPO_PUBLIC_E2E_TEST_MODE
    } else {
      process.env.EXPO_PUBLIC_E2E_TEST_MODE = originalE2ETestMode
    }
  })

  it('does not mark a manually opened guide as seen', () => {
    render(<LearningGuideScreen />)

    expect(useSettingsStore.getState().learningGuideVersionSeen).toBe(0)
  })

  it('persists the current version only after completion and returns', () => {
    const { getByTestId } = render(<LearningGuideScreen />)

    fireEvent.press(getByTestId('complete-learning-guide-button'))

    expect(useSettingsStore.getState().learningGuideVersionSeen).toBe(
      LEARNING_GUIDE_VERSION
    )
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('ignores the E2E reset parameter in normal builds', () => {
    mockUseLocalSearchParams.mockReturnValue({ resetForE2E: '1' })
    useSettingsStore.setState({ learningGuideVersionSeen: 2 })

    render(<LearningGuideScreen />)

    expect(useSettingsStore.getState().learningGuideVersionSeen).toBe(2)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('resets only the guide flag in the dedicated E2E build', () => {
    process.env.EXPO_PUBLIC_E2E_TEST_MODE = 'true'
    mockUseLocalSearchParams.mockReturnValue({ resetForE2E: '1' })
    useSettingsStore.setState({
      autoPlayPronunciation: true,
      learningGuideVersionSeen: 2,
    })

    render(<LearningGuideScreen />)

    expect(useSettingsStore.getState().learningGuideVersionSeen).toBe(0)
    expect(useSettingsStore.getState().autoPlayPronunciation).toBe(true)
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/review')
  })
})
