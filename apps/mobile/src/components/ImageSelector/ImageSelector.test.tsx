import React from 'react'
import { Image } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { supabase } from '@/lib/supabaseClient'
import ImageSelector from './ImageSelector'

jest.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}))
jest.mock('@/lib/supabase', () => ({
  withSessionRetry: (operation: () => Promise<unknown>) => operation(),
}))

const invoke = jest.mocked(supabase.functions.invoke)
const callbacks = { onClose: jest.fn(), onSelect: jest.fn() }
const imageResult = (alt: string) => ({
  data: { images: [{ url: `https://example.com/${alt}.jpg`, alt }] },
  error: null,
})

describe('ImageSelector requests', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it.each(['light', 'dark'] as const)(
    'loads the new word and ignores stale results in %s mode',
    async scheme => {
      const native =
        jest.requireActual<typeof import('react-native')>('react-native')
      jest.spyOn(native, 'useColorScheme').mockReturnValue(scheme)
      let finishPrevious: (
        value: ReturnType<typeof imageResult>
      ) => void = () => {}
      invoke
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              finishPrevious = resolve
            })
        )
        .mockResolvedValueOnce(imageResult('table'))
      const { rerender, queryByText, UNSAFE_getAllByType } = render(
        <ImageSelector
          {...callbacks}
          visible
          englishTranslation="house"
          partOfSpeech="noun"
        />
      )
      rerender(
        <ImageSelector
          {...callbacks}
          visible
          englishTranslation="table"
          partOfSpeech="noun"
        />
      )
      await waitFor(() =>
        expect(invoke).toHaveBeenLastCalledWith(
          'get-multiple-images',
          expect.objectContaining({
            body: expect.objectContaining({ englishTranslation: 'table' }),
          })
        )
      )
      await act(async () => {
        finishPrevious(imageResult('house'))
      })
      expect(queryByText('Finding better images...')).toBeNull()
      expect(
        UNSAFE_getAllByType(Image).map(image => image.props.source.uri)
      ).toEqual(['https://example.com/table.jpg'])
    }
  )

  it('searches only on submission and retains the query when reopened', async () => {
    invoke.mockResolvedValue(imageResult('house'))
    const { getByPlaceholderText, rerender } = render(
      <ImageSelector
        {...callbacks}
        visible
        englishTranslation="house"
        partOfSpeech="noun"
      />
    )
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1))
    fireEvent.changeText(
      getByPlaceholderText('Change search query...'),
      'canal house'
    )
    expect(invoke).toHaveBeenCalledTimes(1)
    fireEvent(getByPlaceholderText('Change search query...'), 'submitEditing')
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    rerender(
      <ImageSelector
        {...callbacks}
        visible={false}
        englishTranslation="house"
        partOfSpeech="noun"
      />
    )
    rerender(
      <ImageSelector
        {...callbacks}
        visible
        englishTranslation="house"
        partOfSpeech="noun"
      />
    )
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(3))
    expect(invoke).toHaveBeenLastCalledWith(
      'get-multiple-images',
      expect.objectContaining({
        body: expect.objectContaining({ englishTranslation: 'canal house' }),
      })
    )
  })
})
