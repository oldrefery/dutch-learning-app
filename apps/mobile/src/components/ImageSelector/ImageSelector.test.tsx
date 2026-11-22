import React from 'react'
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
    callbacks.onSelect.mockClear()
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
      const { rerender, queryByText, getByRole, queryByRole } = await render(
        <ImageSelector
          {...callbacks}
          visible
          englishTranslation="house"
          partOfSpeech="noun"
        />
      )
      await rerender(
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
      expect(queryByRole('button', { name: 'house' })).toBeNull()
      await fireEvent.press(getByRole('button', { name: 'table' }))
      expect(callbacks.onSelect).toHaveBeenCalledWith(
        'https://example.com/table.jpg'
      )
    }
  )

  it('searches only on submission and retains the query when reopened', async () => {
    invoke.mockResolvedValue(imageResult('house'))
    const { getByPlaceholderText, rerender } = await render(
      <ImageSelector
        {...callbacks}
        visible
        englishTranslation="house"
        partOfSpeech="noun"
      />
    )
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1))
    await fireEvent.changeText(
      getByPlaceholderText('Change search query...'),
      'canal house'
    )
    expect(invoke).toHaveBeenCalledTimes(1)
    await fireEvent(
      getByPlaceholderText('Change search query...'),
      'submitEditing'
    )
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    await rerender(
      <ImageSelector
        {...callbacks}
        visible={false}
        englishTranslation="house"
        partOfSpeech="noun"
      />
    )
    await rerender(
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
