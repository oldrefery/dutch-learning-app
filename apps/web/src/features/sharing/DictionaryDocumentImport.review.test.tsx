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

// Review baseline for ab8d603: passing proves the wrong-target recovery link.
// The repair must replace this counterexample with an original-target assertion.
it('reproduces an uncertain import check link drifting to a different collection', async () => {
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
  jest
    .mocked(requestDictionaryTransfer)
    .mockRejectedValue(new Error('Lost reply'))
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
    screen.getByRole('link', { name: 'Check the selected collection' })
  ).toHaveAttribute('href', `/app/collections/${TARGET}`)

  fireEvent.change(screen.getByLabelText('Import into'), {
    target: { value: OTHER_TARGET },
  })

  // No request was sent to OTHER_TARGET, but the recovery link now points there.
  expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('link', { name: 'Check the selected collection' })
  ).toHaveAttribute('href', `/app/collections/${OTHER_TARGET}`)
  expect(
    screen.getByRole('button', { name: 'Import 1 selected word' })
  ).toBeDisabled()
})
