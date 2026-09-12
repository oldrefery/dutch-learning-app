import { act, render, screen } from '@testing-library/react'
import { flushReviewFreshness } from '@/features/review/freshness-actions'
import {
  ReviewFreshnessProvider,
  useReviewFreshness,
} from './ReviewFreshnessProvider'

jest.mock('next/navigation', () => ({ usePathname: () => '/app/review' }))

function Controls() {
  const freshness = useReviewFreshness()
  return (
    <>
      <button onClick={freshness.beginAttempt} type="button">
        Begin
      </button>
      <button
        onClick={() => freshness.settleAttempt('confirmed')}
        type="button"
      >
        Confirm
      </button>
      <button onClick={freshness.flushAtBoundary} type="button">
        Flush
      </button>
    </>
  )
}

beforeEach(() => {
  jest.mocked(flushReviewFreshness).mockReset().mockResolvedValue(true)
})

test('coalesces confirmed attempts into one settled boundary refresh', async () => {
  render(
    <ReviewFreshnessProvider userId="account-a">
      <Controls />
    </ReviewFreshnessProvider>
  )

  await act(async () => {
    screen.getByRole('button', { name: 'Begin' }).click()
    screen.getByRole('button', { name: 'Confirm' }).click()
    screen.getByRole('button', { name: 'Begin' }).click()
    screen.getByRole('button', { name: 'Confirm' }).click()
    screen.getByRole('button', { name: 'Flush' }).click()
  })

  expect(flushReviewFreshness).toHaveBeenCalledTimes(1)
  expect(flushReviewFreshness).toHaveBeenCalledWith('account-a')
})

test('defers a boundary refresh until the in-flight attempt settles', async () => {
  render(
    <ReviewFreshnessProvider userId="account-a">
      <Controls />
    </ReviewFreshnessProvider>
  )

  await act(async () => {
    screen.getByRole('button', { name: 'Begin' }).click()
    screen.getByRole('button', { name: 'Flush' }).click()
  })
  expect(flushReviewFreshness).not.toHaveBeenCalled()

  await act(async () => {
    screen.getByRole('button', { name: 'Confirm' }).click()
  })
  expect(flushReviewFreshness).toHaveBeenCalledWith('account-a')
})
