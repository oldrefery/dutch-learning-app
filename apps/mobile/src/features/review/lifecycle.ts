import { AppState, Platform } from 'react-native'
import { autoAdvanceReview, getReviewAutoAdvance } from '@woordenaar/domain'
import type { NativeReviewController } from './controller'

/** Install only for a focused route; native blur and app background are separate. */
export function attachNativeReviewLifecycle(
  controller: NativeReviewController
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let blurred = false
  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const schedule = () => {
    clear()
    const ticket = getReviewAutoAdvance(controller.getSnapshot())
    if (ticket)
      timer = setTimeout(
        () => {
          controller.transition(flow =>
            autoAdvanceReview(flow, ticket, Date.now())
          )
        },
        Math.max(0, ticket.notBefore - Date.now())
      )
  }
  const update = () =>
    controller.setForeground(AppState.currentState === 'active' && !blurred)
  update()
  void controller.corrections.restore()
  const unsubscribe = controller.subscribe(schedule)
  const subscriptions = [
    AppState.addEventListener('change', state => {
      controller.setForeground(state === 'active' && !blurred)
    }),
  ]
  if (Platform.OS === 'android') {
    subscriptions.push(
      AppState.addEventListener('blur', () => {
        blurred = true
        update()
      }),
      AppState.addEventListener('focus', () => {
        blurred = false
        update()
      })
    )
  }
  schedule()
  return () => {
    clear()
    unsubscribe()
    subscriptions.forEach(subscription => subscription.remove())
    controller.setForeground(false)
  }
}
