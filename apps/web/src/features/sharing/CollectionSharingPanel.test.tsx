import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useActionState } from 'react'
import { CollectionSharingPanel } from './CollectionSharingPanel'
import type { CollectionSharingState } from './form-state'

jest.mock('react', () => {
  const actual = jest.requireActual<typeof import('react')>('react')
  return { ...actual, useActionState: jest.fn() }
})

jest.mock('./actions', () => ({
  updateCollectionSharing: jest.fn(),
}))

const mockUseActionState = jest.mocked(useActionState)
const privateState: CollectionSharingState = {
  isShared: false,
  message: null,
  shareUrl: null,
  status: 'idle',
}

const renderPanel = (
  state: CollectionSharingState = privateState,
  pending = false
) => {
  mockUseActionState.mockReturnValue([state, jest.fn(), pending])
  return render(
    <CollectionSharingPanel collectionId="collection-1" initialState={state} />
  )
}

describe('CollectionSharingPanel', () => {
  test('renders a private collection publish action', () => {
    renderPanel()

    expect(
      screen.getByRole('heading', { name: 'Private collection' })
    ).toBeVisible()
    expect(screen.queryByLabelText('Share link')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Publish collection' })
    ).toHaveValue('publish')
  })

  test('renders a published link and copies it', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const state: CollectionSharingState = {
      isShared: true,
      message: 'Collection published.',
      shareUrl: 'https://woordenaar.app/shared/token',
      status: 'success',
    }
    renderPanel(state)

    expect(screen.getByLabelText('Share link')).toHaveValue(state.shareUrl)
    expect(screen.getByRole('button', { name: 'Stop sharing' })).toHaveValue(
      'stop'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(state.shareUrl))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Link copied.')
    )
  })

  test('reports clipboard and server errors accessibly', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockRejectedValue(new Error('Denied')) },
    })
    const state: CollectionSharingState = {
      isShared: true,
      message: 'Sharing update failed.',
      shareUrl: 'https://woordenaar.app/shared/token',
      status: 'error',
    }
    renderPanel(state, true)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sharing update failed.'
    )
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Copy failed. Select the link manually.'
      )
    )
  })
})
