import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WordManagementForms } from './WordManagementForms'
import { resetWordProgress } from './actions'

jest.mock('./actions', () => ({
  resetWordProgress: jest.fn(),
  moveWord: jest.fn(),
  deleteWord: jest.fn(),
  reanalyzeWord: jest.fn(),
}))

test('retains a reset request across a failed response and renews it only after success', async () => {
  const requests: Record<string, FormDataEntryValue>[] = []
  jest
    .mocked(resetWordProgress)
    .mockImplementation(async (_collection, _word, _state, form) => {
      requests.push(Object.fromEntries(form.entries()))
      return requests.length === 1
        ? { status: 'error', message: 'Connection lost' }
        : { status: 'success', message: 'Word progress reset.' }
    })
  render(
    <WordManagementForms
      canUseAi={false}
      collectionId="collection"
      wordId="word"
      moveTargets={[]}
    />
  )
  const submit = () =>
    fireEvent.submit(
      screen.getByRole('button', { name: 'Reset progress' }).closest('form')!
    )
  submit()
  await screen.findByText('Connection lost')
  submit()
  await screen.findByText('Word progress reset.')
  expect(requests[0]).toEqual(requests[1])
  expect(requests[0].resetId).toEqual(expect.any(String))
  expect(requests[0].reviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  submit()
  await waitFor(() => expect(requests).toHaveLength(3))
  expect(requests[2].resetId).not.toBe(requests[1].resetId)
})
