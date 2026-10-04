import { fireEvent, render, screen } from '@testing-library/react'
import CollectionError from '@/app/app/collections/[collectionId]/error'
import WordError from '@/app/app/collections/[collectionId]/words/[wordId]/error'
import ReviewError from '@/app/app/review/error'
import StarterPackError from '@/app/app/starter-pack/error'
import SharedCollectionError from '@/app/share/[shareToken]/error'

jest.mock('@/lib/observability/useReportError', () => ({
  useReportError: jest.fn(),
}))

it.each([
  CollectionError,
  WordError,
  ReviewError,
  StarterPackError,
  SharedCollectionError,
])(
  'requests a new server render instead of only clearing the failed boundary',
  Component => {
    const retry = jest.fn()
    const reset = jest.fn()
    const props = { error: new Error('Dictionary unavailable'), retry, reset }
    render(<Component {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Try again|Retry/ }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  }
)
