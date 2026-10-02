import { fireEvent, render, screen } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { requestDictionaryTransfer } from './dictionary-transfer-contract'
import { DictionaryDocumentImport } from './DictionaryDocumentImport'
import { document, OWNER, TARGET } from './__fixtures__/dictionary-transfer'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('./dictionary-transfer-contract', () => ({
  ...jest.requireActual('./dictionary-transfer-contract'),
  requestDictionaryTransfer: jest.fn(),
}))

const OTHER_TARGET = '20000000-0000-4000-8000-000000000002'

// Safety regression converted from the ab8d603 review counterexample.
it.each(['lost-transport', 'uncertain-receipt'])(
  'keeps the attempted destination after selection changes: %s',
  async mode => {
    jest.mocked(createClient).mockReturnValue({
      auth: {
        onAuthStateChange: (
          callback: (event: string, session: { user: { id: string } }) => void
        ) => {
          callback('INITIAL_SESSION', { user: { id: OWNER } })
          return { data: { subscription: { unsubscribe: jest.fn() } } }
        },
      },
    } as never)
    if (mode === 'lost-transport')
      jest
        .mocked(requestDictionaryTransfer)
        .mockRejectedValue(new Error('Lost reply'))
    else
      jest.mocked(requestDictionaryTransfer).mockResolvedValue({
        status: 'uncertain',
        message: 'The import could not be confirmed.',
      })
    render(
      <DictionaryDocumentImport
        ownerId={OWNER}
        collections={[
          { id: TARGET, name: 'Attempted destination' },
          { id: OTHER_TARGET, name: 'Unrelated destination' },
        ]}
        existingWords={[]}
      />
    )
    fireEvent.change(screen.getByLabelText('JSON document'), {
      target: { value: JSON.stringify(document) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview words' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 selected word' })
    )
    await screen.findByRole('alert')
    expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
    expect(requestDictionaryTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: TARGET })
    )
    expect(
      screen.getByRole('link', { name: 'Check the attempted collection' })
    ).toHaveAttribute('href', `/app/collections/${TARGET}`)

    fireEvent.change(screen.getByLabelText('Import into'), {
      target: { value: OTHER_TARGET },
    })

    // Changing the next destination must not retarget reconciliation of this attempt.
    expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('link', { name: 'Check the attempted collection' })
    ).toHaveAttribute('href', `/app/collections/${TARGET}`)
    expect(
      screen.getByRole('button', { name: 'Import 1 selected word' })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Preview words' }))
    expect(
      screen.queryByRole('link', { name: 'Check the attempted collection' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Import 1 selected word' })
    ).toBeEnabled()
    expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
  }
)
