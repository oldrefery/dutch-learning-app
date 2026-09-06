import React, { useSyncExternalStore } from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { previousReviewWord, returnToReviewQuestion } from '@woordenaar/domain'
import { ReviewCorrectionControls } from '../ReviewCorrectionControls'
import { ReviewFlowControls } from '../ReviewFlowControls'
import { makeController } from '@/features/review/__tests__/fixtures'
import type { NativeReviewController } from '@/features/review/controller'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

const CHANGE_HARD = 'Change to hard'
const RETRY_CORRECTION = 'Retry same correction'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

function Harness({ controller }: { controller: NativeReviewController }) {
  const flow = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  )
  return (
    <>
      <ReviewFlowControls flow={flow} controller={controller} />
      <ReviewCorrectionControls flow={flow} controller={controller} />
    </>
  )
}

async function setup() {
  const transport = {
    ownsSession: () => true,
    apply: jest.fn().mockResolvedValue({
      kind: 'confirmed',
      result: {
        eventId: 'event-1',
        wordId: 'word-0',
        revision: 1,
        assessment: 'hard',
      },
    }),
    keepServer: jest.fn().mockResolvedValue(null),
  }
  const controller = makeController(undefined, true, transport)
  controller.selectOption('word-0')
  await controller.submit('good')
  controller.transition(previousReviewWord)
  return {
    controller,
    transport,
    screen: render(<Harness controller={controller} />),
  }
}

describe.each(['light', 'dark'] as const)(
  'correction controls in %s theme',
  theme => {
    beforeEach(() =>
      jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    )
    it('disables the existing rating and updates controls after acknowledgement', async () => {
      const { screen, transport } = await setup()
      expect(screen.getByLabelText('Change to good')).toBeDisabled()
      expect(screen.toJSON()).toMatchSnapshot()
      fireEvent.press(screen.getByLabelText(CHANGE_HARD))
      await act(async () => {})
      expect(screen.getByLabelText(CHANGE_HARD)).toBeDisabled()
      expect(screen.getByLabelText('Change to good')).not.toBeDisabled()
      expect(transport.apply).toHaveBeenCalledTimes(1)
      expect(
        screen.getByText('Assessment updated. No extra review was recorded.')
      ).toBeTruthy()
    })
  }
)

it('offers retry after a lost reply even when browsing the pending question', async () => {
  const { screen, controller, transport } = await setup()
  transport.apply.mockRejectedValueOnce(new Error('offline'))
  fireEvent.press(screen.getByLabelText(CHANGE_HARD))
  await act(async () => {})
  act(() => controller.transition(returnToReviewQuestion))
  expect(
    screen.getByText(
      'Resolve the pending correction before answering another word.'
    )
  ).toBeTruthy()
  act(() => controller.setForeground(false))
  expect(screen.getByLabelText(RETRY_CORRECTION)).toBeDisabled()
  act(() => controller.setForeground(true))
  fireEvent.press(screen.getByLabelText(RETRY_CORRECTION))
  await act(async () => {})
  expect(transport.apply.mock.calls[1][0]).toBe(
    transport.apply.mock.calls[0][0]
  )
  expect(screen.queryByLabelText(RETRY_CORRECTION)).toBeNull()
})

it('requires explicit server refresh after a conflict and removes editing for that event', async () => {
  const { screen, transport } = await setup()
  transport.apply.mockResolvedValue({ kind: 'conflict' })
  fireEvent.press(screen.getByLabelText('Change to easy'))
  await act(async () => {})
  expect(screen.queryByLabelText(CHANGE_HARD)).toBeNull()
  expect(transport.keepServer).not.toHaveBeenCalled()
  fireEvent.press(screen.getByLabelText('Keep server version'))
  await act(async () => {})
  expect(transport.keepServer).toHaveBeenCalledTimes(1)
  expect(screen.queryByLabelText(CHANGE_HARD)).toBeNull()
})

it('shows an honest unavailable notice without a production transport', async () => {
  const controller = makeController(undefined, true)
  controller.selectOption('word-0')
  await controller.submit('good')
  controller.transition(previousReviewWord)
  const screen = render(<Harness controller={controller} />)
  expect(
    screen.getByText('Assessment changes are not available in this build yet.')
  ).toBeTruthy()
  expect(screen.queryByLabelText(CHANGE_HARD)).toBeNull()
})
