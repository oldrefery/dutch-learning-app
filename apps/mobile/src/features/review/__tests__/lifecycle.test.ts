import { AppState, Platform, type AppStateStatus } from 'react-native'
import { openReviewDetails } from '@woordenaar/domain'
import { attachNativeReviewLifecycle } from '../lifecycle'
import { makeController, deferred } from './fixtures'

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn() },
  Platform: { OS: 'android' },
}))
let listeners: Record<string, (state: AppStateStatus) => void>
let remove: jest.Mock
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-06T12:00:00Z'))
  AppState.currentState = 'active'
  listeners = {}
  remove = jest.fn()
  jest
    .mocked(AppState.addEventListener)
    .mockImplementation((event, listener) => {
      listeners[event] = listener
      return { remove }
    })
})
afterEach(() => jest.useRealTimers())

it('advances a correct acknowledged answer once and cleans up all native listeners', async () => {
  const controller = makeController()
  const detach = attachNativeReviewLifecycle(controller)
  controller.selectOption('word-0')
  await jest.advanceTimersByTimeAsync(599)
  expect(controller.getSnapshot().history).toHaveLength(0)
  await jest.advanceTimersByTimeAsync(1)
  expect(controller.getSnapshot().history).toHaveLength(1)
  detach()
  expect(remove).toHaveBeenCalledTimes(Platform.OS === 'android' ? 3 : 1)
  expect(jest.getTimerCount()).toBe(0)
})

it.each(['change', 'blur', 'details', 'detach'])(
  'cancels auto-advance on %s',
  async event => {
    const controller = makeController()
    const detach = attachNativeReviewLifecycle(controller)
    controller.selectOption('word-0')
    await Promise.resolve()
    if (event === 'change') listeners.change('inactive')
    if (event === 'blur') listeners.blur('active')
    if (event === 'details') controller.transition(openReviewDetails)
    if (event === 'detach') detach()
    await jest.advanceTimersByTimeAsync(1000)
    expect(controller.getSnapshot().history).toHaveLength(0)
    expect(jest.getTimerCount()).toBe(0)
    if (event !== 'detach') detach()
  }
)

it('does not restart automatic progression when focus or the route returns', async () => {
  const controller = makeController()
  const detach = attachNativeReviewLifecycle(controller)
  controller.selectOption('word-0')
  listeners.blur('active')
  await Promise.resolve()
  listeners.focus('active')
  detach()
  const detachAgain = attachNativeReviewLifecycle(controller)
  await jest.advanceTimersByTimeAsync(1000)
  expect(controller.getSnapshot().history).toHaveLength(0)
  expect(controller.getSnapshot().foreground).toBe(true)
  detachAgain()
})

it('never schedules a timer from a save completed after unmount', async () => {
  const pending = deferred()
  const controller = makeController(jest.fn().mockReturnValue(pending.promise))
  const detach = attachNativeReviewLifecycle(controller)
  controller.selectOption('word-0')
  detach()
  pending.resolve()
  await Promise.resolve()
  expect(jest.getTimerCount()).toBe(0)
  expect(controller.getSnapshot().active?.submission?.status).toBe('saved')
})
