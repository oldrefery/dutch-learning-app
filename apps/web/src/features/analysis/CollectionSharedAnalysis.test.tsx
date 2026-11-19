import { fireEvent, render, screen } from '@testing-library/react'
import { CollectionSharedAnalysis } from './CollectionSharedAnalysis'
import { lookupPublishedMeanings } from './dictionary-meaning-lookup'
import { refreshPublishedMeaning } from './refresh-published-meaning'
import {
  transferSession,
  TRANSFER_OWNER,
} from '@/features/sharing/__fixtures__/following-transfer'

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))
jest.mock('./dictionary-meaning-lookup', () => ({
  lookupPublishedMeanings: jest.fn(),
}))
jest.mock('./refresh-published-meaning', () => ({
  refreshPublishedMeaning: jest.fn(),
}))

const document = transferSession().document
const linked = document.entries[0]
const second = {
  ...linked,
  shared_reference: {
    ...linked.shared_reference!,
    reference: {
      ...linked.shared_reference!.reference,
      entry_id: '2a292929-2929-4929-8929-292929292929',
    },
  },
}
const props = {
  userId: TRANSFER_OWNER,
  lemma: linked.content.dutch_lemma,
  article: linked.content.article,
  partOfSpeech: linked.content.part_of_speech,
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(lookupPublishedMeanings).mockResolvedValue({
    ...document,
    entries: [second, linked],
  })
  jest.mocked(refreshPublishedMeaning).mockResolvedValue({
    updated: linked,
    message: 'Shared analysis published.',
  })
})

it('targets the linked entry on a following card and reloads the card after publication', async () => {
  render(
    <CollectionSharedAnalysis
      {...props}
      entryId={linked.shared_reference!.reference.entry_id}
    />
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Refresh shared analysis' })
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Shared analysis published.'
  )
  expect(refreshPublishedMeaning).toHaveBeenCalledWith(TRANSFER_OWNER, linked)
  expect(mockRefresh).toHaveBeenCalledTimes(1)
})

it('requires a choice before requesting a shared refresh for an ambiguous personal card', async () => {
  render(<CollectionSharedAnalysis {...props} />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Refresh shared analysis' })
  )
  const picker = await screen.findByRole('combobox', {
    name: 'Choose a meaning',
  })
  expect(refreshPublishedMeaning).not.toHaveBeenCalled()
  fireEvent.change(picker, {
    target: { value: second.shared_reference.reference.entry_id },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Refresh shared analysis' })
  )
  await screen.findByRole('status')
  expect(refreshPublishedMeaning).toHaveBeenCalledWith(TRANSFER_OWNER, second)
})
