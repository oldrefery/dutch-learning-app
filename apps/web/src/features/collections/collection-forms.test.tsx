import { render, screen } from '@testing-library/react'
import { useActionState } from 'react'
import { CreateCollectionForm } from './CreateCollectionForm'
import { DeleteCollectionForm } from './DeleteCollectionForm'
import type { CollectionFormState } from './form-state'
import { INITIAL_COLLECTION_FORM_STATE } from './form-state'
import { RenameCollectionForm } from './RenameCollectionForm'

jest.mock('react', () => {
  const actual = jest.requireActual<typeof import('react')>('react')
  return { ...actual, useActionState: jest.fn() }
})

jest.mock('./actions', () => ({
  createCollection: jest.fn(),
  deleteCollection: jest.fn(),
  renameCollection: jest.fn(),
}))

const mockUseActionState = jest.mocked(useActionState)

const mockFormState = (
  state: CollectionFormState = INITIAL_COLLECTION_FORM_STATE,
  pending = false
) => {
  mockUseActionState.mockReturnValue([state, jest.fn(), pending])
}

describe('collection forms', () => {
  beforeEach(() => mockFormState())

  test('renders the create form and reports validation errors', () => {
    mockFormState({
      status: 'error',
      message: 'Collection was not created.',
      fieldErrors: { name: 'Enter a collection name.' },
    })

    render(<CreateCollectionForm />)

    expect(screen.getByLabelText('Collection name')).toHaveAttribute(
      'maxlength',
      '50'
    )
    expect(screen.getByLabelText('Collection name')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Collection was not created.'
    )
    expect(screen.getByText('Enter a collection name.')).toBeVisible()
  })

  test('resets a successful create form and exposes pending state', () => {
    const reset = jest
      .spyOn(HTMLFormElement.prototype, 'reset')
      .mockImplementation(() => undefined)
    mockFormState({ status: 'success', message: 'Collection created.' }, true)

    render(<CreateCollectionForm />)

    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Collection created.')
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  test('renders rename defaults, field errors, and pending state', () => {
    mockFormState(
      {
        status: 'error',
        message: 'Rename failed.',
        fieldErrors: { name: 'Name is unavailable.' },
      },
      true
    )

    render(
      <RenameCollectionForm collectionId="collection-1" currentName="Travel" />
    )

    expect(screen.getByLabelText('New collection name')).toHaveValue('Travel')
    expect(screen.getByText('Name is unavailable.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Rename failed.')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  test.each([
    [1, '1 word'],
    [2, '2 words'],
  ] as const)('describes deletion of %s words', (totalWords, copy) => {
    render(
      <DeleteCollectionForm
        collectionId="collection-1"
        collectionName="Travel"
        totalWords={totalWords}
      />
    )

    expect(screen.getByText(new RegExp(copy))).toBeVisible()
    expect(screen.getByText('Travel')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Delete permanently' })
    ).toBeEnabled()
  })

  test('reports delete validation errors and pending state', () => {
    mockFormState(
      {
        status: 'error',
        message: 'Deletion failed.',
        fieldErrors: { confirmation: 'The collection name does not match.' },
      },
      true
    )

    render(
      <DeleteCollectionForm
        collectionId="collection-1"
        collectionName="Travel"
        totalWords={3}
      />
    )

    expect(
      screen.getByLabelText('Collection name confirmation')
    ).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText('The collection name does not match.')
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Deletion failed.')
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
  })
})
