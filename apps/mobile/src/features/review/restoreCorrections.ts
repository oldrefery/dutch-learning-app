import type {
  CorrectionTarget,
  NativeCorrectionState,
  NativeCorrectionTransport,
} from './correctionTypes'

export function createCorrectionRestoration(
  target: CorrectionTarget,
  transport: NativeCorrectionTransport | undefined,
  snapshot: () => NativeCorrectionState,
  update: (patch: Partial<NativeCorrectionState>) => void,
  validSession: () => boolean
) {
  let loading = false
  return async () => {
    const state = snapshot()
    if (
      !transport?.loadPending ||
      loading ||
      !validSession() ||
      !['checking', 'loadFailed'].includes(state.status)
    )
      return
    loading = true
    update({
      status: 'checking',
      notice: state.status === 'loadFailed' ? null : state.notice,
    })
    try {
      const pending = await transport.loadPending()
      if (!validSession()) return
      if (pending) {
        if (pending.user_id !== target.getSnapshot().userId)
          throw new Error('Foreign pending correction')
        const {
          correction_id,
          event_id,
          word_id,
          user_id,
          expected_revision,
          assessment,
        } = pending
        update({
          command: Object.freeze({
            correction_id,
            event_id,
            word_id,
            user_id,
            expected_revision,
            assessment,
          }),
          status: pending.status === 'conflict' ? 'conflict' : 'retry',
          notice:
            'An unfinished assessment change was restored. Finish it before continuing.',
        })
      } else {
        target.blockWrites(false)
        update({ status: 'idle' })
      }
    } catch {
      if (validSession())
        update({
          status: 'loadFailed',
          notice:
            'Could not restore pending corrections. Retry before continuing.',
        })
    } finally {
      loading = false
    }
  }
}
