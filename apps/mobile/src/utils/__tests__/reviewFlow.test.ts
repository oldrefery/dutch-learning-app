import {
  createReviewFlow,
  selectReviewOption,
  revealReviewAnswer,
  beginReviewSubmission,
  settleReviewSubmission,
  getAutomaticReviewAssessment,
  getAllowedReviewAssessments,
  continueReviewFlow,
  getReviewAutoAdvance,
  autoAdvanceReview,
  openReviewDetails,
  closeReviewDetails,
  previousReviewWord,
  browseReviewHistory,
  returnToReviewQuestion,
  setReviewForeground,
  setReviewManualRecognition,
  skipAssistedReview,
  closeReviewFlow,
  reconcileReviewHistory,
  summarizeReviewFlow,
  type ReviewFlowQuestion,
  type ReviewFlowState,
  type SRSAssessmentType,
} from '@woordenaar/domain'

const start = 1000
const answered = 1250
const sessionId = 'session-qa'
const firstEventId = 'event-first'
const secondEventId = 'event-second'
const userId = 'synthetic-qa'
const options = [
  { id: 'house', label: 'house', isCorrect: true },
  { id: 'boat', label: 'boat', isCorrect: false },
]
const question = (
  id: string,
  mode: ReviewFlowQuestion<string>['mode'] = 'recognition'
): ReviewFlowQuestion<string> => ({
  id,
  wordId: `word-${id}`,
  mode,
  options,
  payload: `snapshot-${id}`,
})
const create = (
  questions = [question('first'), question('second')],
  manualRecognition = false
) =>
  createReviewFlow({
    sessionId,
    userId,
    questions,
    now: start,
    manualRecognition,
  })

function save(
  state: ReviewFlowState<string>,
  assessment: SRSAssessmentType = 'good',
  eventId = firstEventId
) {
  const pending = beginReviewSubmission(
    state,
    state.active!.question.id,
    eventId,
    assessment
  )
  expect(pending).not.toBe(state)
  return settleReviewSubmission(pending, sessionId, eventId, {
    status: 'saved',
  })
}

function completeFirst() {
  const saved = save(selectReviewOption(create(), 'first', 'house', answered))
  return continueReviewFlow(saved, 'first', 2000)
}

function advanceSaved(
  state: ReviewFlowState<string>,
  questionId: string,
  now: number
) {
  const ticket = getReviewAutoAdvance(state)
  return ticket
    ? autoAdvanceReview(state, ticket, now)
    : continueReviewFlow(state, questionId, now)
}

describe('shared fast review flow', () => {
  it('keeps completion and event counts consistent through a mixed 100-word session', () => {
    let state = create(
      Array.from({ length: 100 }, (_, index) => question(`q-${index}`))
    )
    let skipped = 0
    for (let index = 0; index < 100; index += 1) {
      const id = `q-${index}`
      const now = 2000 + index * 2000
      if (index % 5 === 0) {
        state = skipAssistedReview(openReviewDetails(state), id, now)
        skipped += 1
      } else {
        state = selectReviewOption(state, id, index % 2 ? 'house' : 'boat', now)
        const rating = state.active!.answeredCorrectly ? 'good' : 'again'
        state = save(state, rating, `event-${index}`)
        if (index % 3 === 0)
          state = returnToReviewQuestion(previousReviewWord(state))
        state = advanceSaved(state, id, now + 600)
        state = reconcileReviewHistory(state, `event-${index}`, 1, 'hard')
      }
      expect(state.history).toHaveLength(index + 1)
      expect(summarizeReviewFlow(state)).toMatchObject({
        completed: index + 1,
        skipped,
        assessed: index + 1 - skipped,
      })
    }
    expect(summarizeReviewFlow(state)).toMatchObject({
      finished: true,
      counts: { hard: 80, good: 0, again: 0, easy: 0 },
    })
    const eventIds = state.history.flatMap(entry =>
      entry.result.kind === 'assessed' ? [entry.result.eventId] : []
    )
    expect(new Set(eventIds).size).toBe(80)
  })

  it('never mutates caller state during navigation, submission, or history correction', () => {
    const frozen = completeFirst()
    Object.freeze(frozen.history[0].result)
    Object.freeze(frozen.history[0])
    Object.freeze(frozen.history)
    Object.freeze(frozen.active)
    Object.freeze(frozen.view)
    Object.freeze(frozen)
    const before = JSON.stringify(frozen)
    openReviewDetails(frozen)
    previousReviewWord(frozen)
    reconcileReviewHistory(frozen, firstEventId, 1, 'hard')
    selectReviewOption(frozen, 'second', 'house', 2200)
    expect(JSON.stringify(frozen)).toBe(before)
  })

  it('defaults to fast recognition and snapshots option order without mutating input', () => {
    const input = question('first')
    const state = create([input])
    expect(state.active).toMatchObject({
      question: input,
      manualRecognition: false,
      startedAt: start,
    })
    expect(state.active?.question.options).not.toBe(input.options)
    expect(state.active?.question.options[0]).not.toBe(input.options[0])
    expect(getAutomaticReviewAssessment(state)).toBeNull()
    expect(getAllowedReviewAssessments(state)).toEqual([])
  })

  it('advances exactly once after both durable save and the feedback deadline', () => {
    const selected = selectReviewOption(create(), 'first', 'house', answered)
    expect(getAutomaticReviewAssessment(selected)).toBe('good')
    expect(getReviewAutoAdvance(selected)).toBeNull()
    const pending = beginReviewSubmission(
      selected,
      'first',
      firstEventId,
      'good'
    )
    expect(getReviewAutoAdvance(pending)).toBeNull()
    expect(continueReviewFlow(pending, 'first', 9000)).toBe(pending)
    const saved = settleReviewSubmission(pending, sessionId, firstEventId, {
      status: 'saved',
    })
    const ticket = getReviewAutoAdvance(saved)!
    expect(ticket.notBefore).toBe(answered + 600)
    expect(autoAdvanceReview(saved, ticket, ticket.notBefore - 1)).toBe(saved)
    const next = autoAdvanceReview(saved, ticket, ticket.notBefore)
    expect(next.active?.question.id).toBe('second')
    expect(next.history).toHaveLength(1)
    expect(autoAdvanceReview(next, ticket, 9999)).toBe(next)
    expect(continueReviewFlow(next, 'first', 9999)).toBe(next)
    expect(summarizeReviewFlow(next)).toMatchObject({
      assessed: 1,
      skipped: 0,
      counts: { good: 1 },
    })
  })

  it('freezes the first selected option and answer time against duplicate clicks', () => {
    const selected = selectReviewOption(create(), 'first', 'house', answered)
    expect(selectReviewOption(selected, 'first', 'boat', 9999)).toBe(selected)
    expect(selected.active?.answeredAt).toBe(answered)
    expect(
      selectReviewOption(create(), 'first', 'missing', answered).active
        ?.selectedOptionId
    ).toBeNull()
  })

  it('opens full details on a wrong choice and waits for an explicit Again/Continue', () => {
    const wrong = selectReviewOption(create(), 'first', 'boat', answered)
    expect(wrong.view.kind).toBe('details')
    expect(wrong.active).toMatchObject({
      answeredCorrectly: false,
      assisted: false,
      revealed: true,
    })
    expect(getAutomaticReviewAssessment(wrong)).toBeNull()
    expect(getAllowedReviewAssessments(wrong)).toEqual(['again'])
    expect(beginReviewSubmission(wrong, 'first', 'invalid', 'good')).toBe(wrong)
    const saved = save(wrong, 'again')
    expect(getReviewAutoAdvance(saved)).toBeNull()
    expect(
      continueReviewFlow(saved, 'first', 999999).history[0].result
    ).toMatchObject({ assessment: 'again' })
  })

  it('retains the original command after an uncertain failure and rejects a different ID or rating', () => {
    const selected = selectReviewOption(create(), 'first', 'house', answered)
    const pending = beginReviewSubmission(
      selected,
      'first',
      firstEventId,
      'good'
    )
    expect(beginReviewSubmission(pending, 'first', firstEventId, 'good')).toBe(
      pending
    )
    const failed = settleReviewSubmission(pending, sessionId, firstEventId, {
      status: 'failed',
      error: 'Offline',
    })
    expect(getAllowedReviewAssessments(failed)).toEqual(['good'])
    expect(beginReviewSubmission(failed, 'first', 'different-id', 'good')).toBe(
      failed
    )
    expect(beginReviewSubmission(failed, 'first', firstEventId, 'easy')).toBe(
      failed
    )
    const retry = beginReviewSubmission(failed, 'first', firstEventId, 'good')
    expect(retry.active?.submission).toMatchObject({
      eventId: firstEventId,
      status: 'saving',
    })
    const saved = settleReviewSubmission(retry, sessionId, firstEventId, {
      status: 'saved',
    })
    expect(
      settleReviewSubmission(saved, sessionId, firstEventId, {
        status: 'failed',
        error: 'Late failure',
      })
    ).toBe(saved)
    expect(
      settleReviewSubmission(saved, sessionId, firstEventId, {
        status: 'saved',
      })
    ).toBe(saved)
  })

  it.each(['details', 'background', 'history'] as const)(
    'invalidates automatic progression after %s until explicit continue',
    reason => {
      const selected = selectReviewOption(
        completeFirst(),
        'second',
        'house',
        2100
      )
      const saved = save(selected, 'good', secondEventId)
      const ticket = getReviewAutoAdvance(saved)!
      const paused =
        reason === 'details'
          ? openReviewDetails(saved)
          : reason === 'background'
            ? setReviewForeground(saved, false)
            : previousReviewWord(saved)
      expect(autoAdvanceReview(paused, ticket, 9000)).toBe(paused)
      const resumed =
        reason === 'details'
          ? closeReviewDetails(paused)
          : reason === 'background'
            ? setReviewForeground(paused, true)
            : returnToReviewQuestion(paused)
      expect(getReviewAutoAdvance(resumed)).toBeNull()
      expect(autoAdvanceReview(resumed, ticket, 9000)).toBe(resumed)
      expect(
        summarizeReviewFlow(continueReviewFlow(resumed, 'second', 9000))
          .finished
      ).toBe(true)
    }
  )

  it('does not advance behind history when a pending save completes', () => {
    const selected = selectReviewOption(
      completeFirst(),
      'second',
      'house',
      2100
    )
    const pending = beginReviewSubmission(
      selected,
      'second',
      secondEventId,
      'good'
    )
    const history = previousReviewWord(pending)
    const saved = settleReviewSubmission(history, sessionId, secondEventId, {
      status: 'saved',
    })
    expect(saved.view).toEqual(history.view)
    expect(saved.active?.submission?.status).toBe('saved')
    expect(getReviewAutoAdvance(saved)).toBeNull()
    expect(continueReviewFlow(saved, 'second', 5000)).toBe(saved)
    const current = returnToReviewQuestion(saved)
    expect(continueReviewFlow(current, 'second', 5000).active).toBeNull()
  })

  it('keeps selection, question snapshot and time intact across history and details', () => {
    const active = selectReviewOption(completeFirst(), 'second', 'house', 2500)
    const history = openReviewDetails(previousReviewWord(active))
    expect(history.view).toEqual({ kind: 'history', index: 0, details: true })
    expect(selectReviewOption(history, 'second', 'boat', 9000)).toBe(history)
    expect(beginReviewSubmission(history, 'second', 'blocked', 'good')).toBe(
      history
    )
    expect(revealReviewAnswer(history, 'second', 9000)).toBe(history)
    expect(skipAssistedReview(history, 'second', 9000)).toBe(history)
    const returned = returnToReviewQuestion(closeReviewDetails(history))
    expect(returned.active).toEqual({ ...active.active, autoPaused: true })
    expect(returned.active?.question).toBe(active.active?.question)
    expect(returned.history).toBe(active.history)
    expect(summarizeReviewFlow(returned)).toEqual(summarizeReviewFlow(active))
  })

  it('supports multiple history entries and still permits inspection after the last word', () => {
    const state = completeFirst()
    const complete = continueReviewFlow(
      save(
        selectReviewOption(state, 'second', 'house', 2500),
        'good',
        secondEventId
      ),
      'second',
      3000
    )
    expect(summarizeReviewFlow(complete).finished).toBe(true)
    const last = previousReviewWord(complete)
    const first = previousReviewWord(last)
    expect(last.view).toEqual({ kind: 'history', index: 1, details: false })
    expect(first.view).toEqual({ kind: 'history', index: 0, details: false })
    expect(previousReviewWord(first)).toBe(first)
    expect(browseReviewHistory(first, 10)).toBe(first)
    expect(browseReviewHistory(first, 0.5)).toBe(first)
    expect(returnToReviewQuestion(first).active).toBeNull()
    expect(openReviewDetails(last).view).toMatchObject({ details: true })
  })

  it('marks a peek permanently assisted even after closing details', () => {
    const peeked = closeReviewDetails(openReviewDetails(create()))
    expect(peeked.active).toMatchObject({ assisted: true, revealed: true })
    expect(selectReviewOption(peeked, 'first', 'house', answered)).toBe(peeked)
    expect(getAllowedReviewAssessments(peeked)).toEqual(['again'])
    expect(getAutomaticReviewAssessment(peeked)).toBeNull()
    expect(beginReviewSubmission(peeked, 'first', 'invalid', 'good')).toBe(
      peeked
    )
    expect(
      continueReviewFlow(save(peeked, 'again'), 'first', 3000).history[0].result
    ).toMatchObject({ assessment: 'again' })
  })

  it('skips a peek without an event, assessment, or successful repetition', () => {
    const state = create()
    expect(skipAssistedReview(state, 'first', 3000)).toBe(state)
    const skipped = skipAssistedReview(openReviewDetails(state), 'first', 3000)
    expect(skipped.history[0].result).toEqual({ kind: 'skipped' })
    expect(summarizeReviewFlow(skipped)).toMatchObject({
      assessed: 0,
      skipped: 1,
      completed: 1,
    })
    const peeked = openReviewDetails(create())
    const pending = beginReviewSubmission(
      peeked,
      'first',
      firstEventId,
      'again'
    )
    expect(skipAssistedReview(pending, 'first', 3000)).toBe(pending)
  })

  it('uses a manual preference snapshot for each question, not an in-flight answer', () => {
    const selected = selectReviewOption(create(), 'first', 'house', answered)
    const changed = setReviewManualRecognition(selected, true)
    expect(changed.active?.manualRecognition).toBe(false)
    expect(getAutomaticReviewAssessment(changed)).toBe('good')
    const next = continueReviewFlow(save(changed), 'first', 3000)
    expect(next.active?.manualRecognition).toBe(true)
    const manual = selectReviewOption(next, 'second', 'house', 3100)
    expect(getAutomaticReviewAssessment(manual)).toBeNull()
    expect(getAllowedReviewAssessments(manual)).toEqual([
      'again',
      'hard',
      'good',
      'easy',
    ])
    expect(getReviewAutoAdvance(save(manual, 'easy', secondEventId))).toBeNull()
  })

  it.each(['meaning-recall', 'dutch-production'] as const)(
    '%s remains manual and requires reveal',
    mode => {
      const state = create([question('first', mode)])
      expect(selectReviewOption(state, 'first', 'house', answered)).toBe(state)
      expect(beginReviewSubmission(state, 'first', 'invalid', 'good')).toBe(
        state
      )
      const revealed = revealReviewAnswer(state, 'first', answered)
      expect(revealed.active).toMatchObject({
        answeredCorrectly: null,
        revealed: true,
        assisted: false,
      })
      expect(revealReviewAnswer(revealed, 'first', 9999)).toBe(revealed)
      expect(getAutomaticReviewAssessment(revealed)).toBeNull()
      expect(getReviewAutoAdvance(save(revealed))).toBeNull()
    }
  )

  it('reconciles effective assessments without another event or changing the unfinished question', () => {
    const state = completeFirst()
    const corrected = reconcileReviewHistory(state, firstEventId, 1, 'again')
    expect(corrected.active).toBe(state.active)
    expect(corrected.history).toHaveLength(1)
    expect(corrected.history[0].question).toBe(state.history[0].question)
    expect(corrected.history[0].result).toEqual({
      kind: 'assessed',
      eventId: firstEventId,
      originalAssessment: 'good',
      assessment: 'again',
      revision: 1,
    })
    expect(summarizeReviewFlow(corrected)).toMatchObject({
      assessed: 1,
      counts: { again: 1, good: 0 },
    })
    const second = reconcileReviewHistory(corrected, firstEventId, 2, 'easy')
    expect(reconcileReviewHistory(second, firstEventId, 1, 'again')).toBe(
      second
    )
    expect(reconcileReviewHistory(second, firstEventId, 2, 'hard')).toBe(second)
    expect(reconcileReviewHistory(second, 'missing', 3, 'good')).toBe(second)
    expect(reconcileReviewHistory(second, firstEventId, NaN, 'good')).toBe(
      second
    )
  })

  it('rejects event-ID reuse for another word in the same session', () => {
    const selected = selectReviewOption(
      completeFirst(),
      'second',
      'house',
      3000
    )
    expect(
      beginReviewSubmission(selected, 'second', firstEventId, 'good')
    ).toBe(selected)
  })

  it('ignores completions from another session or event and clears private snapshots on exit', () => {
    const pending = beginReviewSubmission(
      selectReviewOption(create(), 'first', 'house', answered),
      'first',
      firstEventId,
      'good'
    )
    expect(
      settleReviewSubmission(pending, 'other-session', firstEventId, {
        status: 'saved',
      })
    ).toBe(pending)
    expect(
      settleReviewSubmission(pending, sessionId, 'other-event', {
        status: 'saved',
      })
    ).toBe(pending)
    const closed = closeReviewFlow(pending)
    expect(closed).toMatchObject({
      closed: true,
      active: null,
      remaining: [],
      history: [],
    })
    expect(
      settleReviewSubmission(closed, sessionId, firstEventId, {
        status: 'saved',
      })
    ).toBe(closed)
    expect(openReviewDetails(closed)).toBe(closed)
    expect(setReviewForeground(closed, true)).toBe(closed)
    expect(setReviewManualRecognition(closed, true)).toBe(closed)
    expect(returnToReviewQuestion(closed)).toBe(closed)
    expect(summarizeReviewFlow(closed).finished).toBe(false)
  })

  it('rejects malformed question lists and allows an empty completed session', () => {
    expect(() => create([question('same'), question('same')])).toThrow(
      'duplicate'
    )
    expect(() => create([{ ...question('first'), options: [] }])).toThrow(
      'options'
    )
    expect(() =>
      create([{ ...question('first'), options: [options[0], options[0]] }])
    ).toThrow('options')
    expect(() =>
      createReviewFlow({ sessionId: '', userId, questions: [], now: start })
    ).toThrow('identity')
    expect(summarizeReviewFlow(create([]))).toMatchObject({
      completed: 0,
      finished: true,
    })
  })

  it('rejects stale timer generations, foreign sessions and nonfinite timestamps', () => {
    const saved = save(selectReviewOption(create(), 'first', 'house', answered))
    const ticket = getReviewAutoAdvance(saved)!
    for (const changes of [
      { sessionId: 'other' },
      { questionId: 'other' },
      { timerRevision: 9 },
      { notBefore: 0 },
    ]) {
      expect(autoAdvanceReview(saved, { ...ticket, ...changes }, 9000)).toBe(
        saved
      )
    }
    expect(autoAdvanceReview(saved, ticket, NaN)).toBe(saved)
    expect(continueReviewFlow(saved, 'first', NaN)).toBe(saved)
    const initial = create()
    expect(selectReviewOption(initial, 'first', 'house', NaN)).toBe(initial)
    expect(selectReviewOption(initial, 'stale', 'house', answered)).toBe(
      initial
    )
  })
})
