import React from 'react'
import { ActionSheetIOS, Platform } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import { createMockCollection } from '@/__tests__/helpers/factories'
import { CollectionSelectorSheet } from '@/components/glass/modals/CollectionSelectorSheet'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { CompactWordInput } from '../CompactWordInput'

jest.mock('@/components/glass/modals/CollectionSelectorSheet', () => ({
  CollectionSelectorSheet: jest.fn(() => null),
}))

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

jest.mock('../AnalyzeButton', () => ({ AnalyzeButton: () => null }))

const collections = [
  createMockCollection({ collection_id: 'first', name: 'First' }),
  createMockCollection({ collection_id: 'second', name: 'Second' }),
]
const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS')!
const mockSheet = jest.mocked(CollectionSelectorSheet)
const mockTheme = jest.mocked(useNormalizedColorScheme)
const COLLECTION_SELECTOR_TEST_ID = 'collection-selector'

function renderInput() {
  const onCollectionSelect = jest.fn()
  const result = render(
    <CompactWordInput
      inputWord=""
      setInputWord={jest.fn()}
      onAnalyze={jest.fn()}
      isAnalyzing={false}
      isCheckingDuplicate={false}
      selectedCollection={collections[0]}
      collections={collections}
      onCollectionSelect={onCollectionSelect}
    />
  )
  return { ...result, onCollectionSelect }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTheme.mockReturnValue('light')
})

afterEach(() => {
  Object.defineProperty(Platform, 'OS', platformDescriptor)
  jest.restoreAllMocks()
})

describe.each(['light', 'dark'] as const)(
  'Android %s collection selection',
  theme => {
    it('opens the existing sheet and forwards the selected collection', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      })
      mockTheme.mockReturnValue(theme)
      const actionSheet = jest.spyOn(
        ActionSheetIOS,
        'showActionSheetWithOptions'
      )
      const { getByTestId, onCollectionSelect } = renderInput()

      fireEvent.press(getByTestId(COLLECTION_SELECTOR_TEST_ID))

      expect(actionSheet).not.toHaveBeenCalled()
      expect(mockSheet).toHaveBeenLastCalledWith(
        expect.objectContaining({
          visible: true,
          collections,
          selectedCollectionId: 'first',
        }),
        undefined
      )
      act(() => mockSheet.mock.calls.at(-1)![0].onSelect(collections[1]))
      expect(onCollectionSelect).toHaveBeenCalledWith(collections[1])

      act(() => mockSheet.mock.calls.at(-1)![0].onClose())
      expect(mockSheet.mock.calls.at(-1)![0].visible).toBe(false)
    })
  }
)

it('dismisses the Android sheet without changing the selected collection', () => {
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  })
  const { getByTestId, onCollectionSelect } = renderInput()
  fireEvent.press(getByTestId(COLLECTION_SELECTOR_TEST_ID))
  act(() => mockSheet.mock.calls.at(-1)![0].onClose())
  expect(onCollectionSelect).not.toHaveBeenCalled()
  expect(mockSheet.mock.calls.at(-1)![0].visible).toBe(false)
})

it('preserves the iOS action sheet selection and cancellation', () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
  const actionSheet = jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation(() => {})
  const { getByTestId, onCollectionSelect } = renderInput()
  fireEvent.press(getByTestId(COLLECTION_SELECTOR_TEST_ID))
  expect(actionSheet).toHaveBeenCalledWith(
    {
      options: ['First', 'Second', 'Cancel'],
      cancelButtonIndex: 2,
      title: 'Select Collection',
    },
    expect.any(Function)
  )
  const onSelect = actionSheet.mock.calls[0][1]
  act(() => onSelect(1))
  expect(onCollectionSelect).toHaveBeenCalledWith(collections[1])
  onCollectionSelect.mockClear()
  act(() => onSelect(2))
  expect(onCollectionSelect).not.toHaveBeenCalled()
  expect(mockSheet).not.toHaveBeenCalled()
})
