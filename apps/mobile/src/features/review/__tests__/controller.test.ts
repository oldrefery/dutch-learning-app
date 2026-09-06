import {
  autoAdvanceReview,
  getReviewAutoAdvance,
  openReviewDetails,
  closeReviewDetails,
  previousReviewWord,
  returnToReviewQuestion,
  skipAssistedReview,
  setReviewManualRecognition,
  summarizeReviewFlow,
} from '@woordenaar/domain'
import { makeController, deferred } from './fixtures'

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-06T12:00:00Z'))
})
afterEach(() => jest.useRealTimers())

describe('native review controller', () => {
  it('claims a correct answer once and requires both local acknowledgement and 600ms before advancing', async () => {
    const pending = deferred()
    const persist = jest.fn().mockReturnValue(pending.promise)
    const controller = makeController(persist)
    controller.selectOption('word-0')
    controller.selectOption('word-1')
    await controller.submit('good')
    expect(persist).toHaveBeenCalledTimes(1)
    expect(getReviewAutoAdvance(controller.getSnapshot())).toBeNull()
    pending.resolve()
    await Promise.resolve()
    const ticket = getReviewAutoAdvance(controller.getSnapshot())!
    expect(ticket).not.toBeNull()
    controller.transition(flow =>
      autoAdvanceReview(flow, ticket, Date.now() + 599)
    )
    expect(controller.getSnapshot().history).toHaveLength(0)
    controller.transition(flow =>
      autoAdvanceReview(flow, ticket, Date.now() + 600)
    )
    expect(controller.getSnapshot().history).toHaveLength(1)
    controller.transition(flow =>
      autoAdvanceReview(flow, ticket, Date.now() + 9999)
    )
    expect(controller.getSnapshot().active?.question.wordId).toBe('word-1')
  })

  it('retries an uncertain local save with the identical command, not another assessment', async () => {
    const persist = jest
      .fn()
      .mockRejectedValueOnce(new Error('disk failure'))
      .mockResolvedValue(undefined)
    const controller = makeController(persist)
    controller.selectOption('word-0')
    await Promise.resolve()
    expect(controller.exit()).toBe(false)
    jest.setSystemTime(new Date('2026-09-07T12:00:00Z'))
    await controller.submit('easy')
    expect(persist).toHaveBeenCalledTimes(1)
    await controller.submit('good')
    expect(persist.mock.calls[0][0]).toEqual(persist.mock.calls[1][0])
    expect(controller.getSnapshot().history).toHaveLength(1)
  })

  it('opens the full card after a wrong answer and records Again only on Continue', async () => {
    const persist = jest.fn().mockResolvedValue(undefined)
    const controller = makeController(persist)
    controller.selectOption('word-1')
    expect(controller.getSnapshot().view.kind).toBe('details')
    expect(persist).not.toHaveBeenCalled()
    await controller.submit('easy')
    expect(persist).not.toHaveBeenCalled()
    await controller.submit('again')
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ assessment: 'again', answeredCorrectly: false })
    )
    expect(controller.getSnapshot().history).toHaveLength(1)
  })

  it('waits for an explicit assessment in manual Recognition', async () => {
    const persist = jest.fn().mockResolvedValue(undefined)
    const controller = makeController(persist, true)
    controller.selectOption('word-0')
    expect(persist).not.toHaveBeenCalled()
    await controller.submit('hard')
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ assessment: 'hard' })
    )
  })

  it('preserves the pending question and options when browsing multiple completed words', async () => {
    const persist = jest.fn().mockResolvedValue(undefined)
    const controller = makeController(persist, true)
    controller.selectOption('word-0')
    await controller.submit('good')
    controller.selectOption('word-1')
    await controller.submit('easy')
    const question = controller.getSnapshot().active?.question
    controller.transition(previousReviewWord)
    controller.transition(previousReviewWord)
    controller.transition(openReviewDetails)
    await controller.submit('again')
    expect(persist).toHaveBeenCalledTimes(2)
    controller.transition(returnToReviewQuestion)
    expect(controller.getSnapshot().active?.question).toBe(question)
    expect(controller.getSnapshot().active?.autoPaused).toBe(true)
  })

  it('pauses after opening details during a slow save and never restarts the timer implicitly', async () => {
    const pending = deferred()
    const controller = makeController(
      jest.fn().mockReturnValue(pending.promise)
    )
    controller.selectOption('word-0')
    controller.transition(openReviewDetails)
    pending.resolve()
    await Promise.resolve()
    controller.transition(closeReviewDetails)
    expect(getReviewAutoAdvance(controller.getSnapshot())).toBeNull()
    expect(controller.getSnapshot().active?.submission?.status).toBe('saved')
    await controller.submit('good')
    expect(controller.getSnapshot().history).toHaveLength(1)
  })

  it('settles an answer while unfocused but waits for explicit Continue on return', async () => {
    const pending = deferred()
    const controller = makeController(
      jest.fn().mockReturnValue(pending.promise)
    )
    controller.selectOption('word-0')
    controller.setForeground(false)
    pending.resolve()
    await Promise.resolve()
    controller.setForeground(true)
    expect(controller.getSnapshot().active?.submission?.status).toBe('saved')
    expect(getReviewAutoAdvance(controller.getSnapshot())).toBeNull()
    await controller.submit('good')
    expect(controller.getSnapshot().history).toHaveLength(1)
  })

  it('allows only Again or Skip after peeking and keeps skipped words out of review totals', async () => {
    const persist = jest.fn().mockResolvedValue(undefined)
    const controller = makeController(persist)
    controller.transition(openReviewDetails)
    controller.transition(closeReviewDetails)
    controller.selectOption('word-0')
    await controller.submit('good')
    expect(persist).not.toHaveBeenCalled()
    controller.transition(flow =>
      skipAssistedReview(flow, flow.active!.question.id, Date.now())
    )
    expect(summarizeReviewFlow(controller.getSnapshot())).toMatchObject({
      skipped: 1,
      assessed: 0,
    })
  })

  it('keeps history after the final word and ignores commands after exit', async () => {
    const persist = jest.fn().mockResolvedValue(undefined)
    const controller = makeController(persist, true)
    for (const id of ['word-0', 'word-1', 'word-2']) {
      controller.selectOption(id)
      await controller.submit('good')
    }
    expect(summarizeReviewFlow(controller.getSnapshot()).finished).toBe(true)
    controller.transition(previousReviewWord)
    expect(controller.getSnapshot().view.kind).toBe('history')
    expect(controller.exit()).toBe(true)
    await controller.submit('again')
    expect(persist).toHaveBeenCalledTimes(3)
  })

  it('applies preference changes only to the next question', async () => {
    const controller = makeController(undefined, true)
    controller.transition(flow => setReviewManualRecognition(flow, false))
    controller.selectOption('word-0')
    expect(controller.getSnapshot().active?.submission).toBeNull()
    await controller.submit('good')
    expect(controller.getSnapshot().active?.manualRecognition).toBe(false)
  })
})
