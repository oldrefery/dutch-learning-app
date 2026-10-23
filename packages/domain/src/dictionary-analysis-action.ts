import { compareDictionarySequences } from './dictionary-following'
import {
  parseDictionaryAnalysisClientOperation,
  isDictionaryAnalysisTerminal,
  type DictionaryAnalysisClientOperation,
} from './dictionary-analysis-client'
import { DICTIONARY_ANALYSIS_HISTORY_LIMIT } from './dictionary-analysis-attempts'

export interface DictionaryAnalysisActionState {
  loaded: boolean
  contentLoaded: boolean
  allowed: boolean
  nextAllowed: boolean
  history: DictionaryAnalysisClientOperation[] | null
  busy: boolean
  blocked: boolean
  operation: DictionaryAnalysisClientOperation | null
  error: string | null
}
const INITIAL: DictionaryAnalysisActionState = {
  loaded: false,
  contentLoaded: false,
  allowed: false,
  nextAllowed: false,
  history: null,
  busy: false,
  blocked: false,
  operation: null,
  error: null,
}
const SESSION_CHANGED = 'Your session changed. Reopen this word to continue.'
const READ_FAILED =
  'Could not read the saved analysis. Reopen this word to try again.'
const ACTION_FAILED =
  'Could not finish checking the analysis. Your saved request is retained.'
const NOT_STARTED =
  'Could not start shared analysis. Reopen this word to try again.'

/** UI lifetime only. SDK/journal/server retain the authority to validate and dispatch.
 * Mount reads local metadata/eligibility; only an explicit action can submit or recover. */
export function createDictionaryAnalysisAction(ports: {
  userId: string
  wordId: string
  readSaved(): Promise<DictionaryAnalysisClientOperation | null>
  isAvailable(): Promise<boolean>
  createIntent(): DictionaryAnalysisClientOperation
  submit(
    operation: DictionaryAnalysisClientOperation
  ): Promise<DictionaryAnalysisClientOperation>
  loadPublished?(
    operation: DictionaryAnalysisClientOperation
  ): Promise<DictionaryAnalysisClientOperation>
  recover(): Promise<DictionaryAnalysisClientOperation | null>
  nextAttempt?(
    expected: DictionaryAnalysisClientOperation,
    candidate: DictionaryAnalysisClientOperation
  ): Promise<DictionaryAnalysisClientOperation>
  readHistory?(): Promise<DictionaryAnalysisClientOperation[]>
}) {
  let state = INITIAL
  let epoch = 0
  let active = false
  let invalidated = false
  const listeners = new Set<() => void>()
  const update = (patch: Partial<DictionaryAnalysisActionState>) => {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  const current = (request: number) =>
    active && !invalidated && request === epoch
  const verify = (value: DictionaryAnalysisClientOperation | null) => {
    if (!value) return null
    const operation = parseDictionaryAnalysisClientOperation(value)
    if (
      operation.user_id !== ports.userId ||
      operation.word_id !== ports.wordId
    )
      throw new Error('Shared analysis view owner mismatch')
    return operation
  }
  const availability = async (
    operation: DictionaryAnalysisClientOperation | null,
    request: number
  ) => {
    const next =
      !!ports.nextAttempt &&
      !!operation?.submitted &&
      isDictionaryAnalysisTerminal(operation.response)
    if (!operation?.submitted || next) {
      const allowed = await ports.isAvailable()
      if (current(request))
        update({
          allowed: !operation?.submitted && allowed,
          nextAllowed: next && allowed,
        })
    }
  }
  const initialize = async (request: number) => {
    try {
      const operation = verify(await ports.readSaved())
      if (!current(request)) return
      update({
        operation,
        loaded: true,
        error: null,
        allowed: false,
        nextAllowed: false,
      })
      // Submitted requests remain inspectable without permission/readiness probes.
      await availability(operation, request)
    } catch {
      if (current(request))
        update({ loaded: true, allowed: false, error: READ_FAILED })
    }
  }
  const published = (operation: DictionaryAnalysisClientOperation | null) =>
    operation?.response &&
    !('outcome' in operation.response) &&
    ['published', 'no-change'].includes(operation.response.status)
  const run = async (mode: 'submit' | 'recover' | 'next' | 'load') => {
    if (!active || invalidated || state.busy || !state.loaded) return
    if (mode === 'submit' && (!state.allowed || state.operation?.submitted))
      return
    if (mode === 'recover' && !state.operation?.submitted) return
    if (
      mode === 'next' &&
      (!state.nextAllowed || !state.operation || !ports.nextAttempt)
    )
      return
    if (
      mode === 'load' &&
      (!ports.loadPublished || !published(state.operation))
    )
      return
    const request = epoch
    update({ busy: true, error: null })
    try {
      const operation = verify(
        await (mode === 'submit'
          ? ports.submit(state.operation ?? verify(ports.createIntent())!)
          : mode === 'next'
            ? ports.nextAttempt!(
                state.operation!,
                verify(ports.createIntent())!
              )
            : mode === 'load'
              ? ports.loadPublished!(state.operation!)
              : ports.recover())
      )
      if (current(request)) {
        update({
          operation,
          contentLoaded: !!published(operation),
          allowed: false,
          nextAllowed: false,
        })
        await availability(operation, request)
        if (current(request) && state.history !== null)
          await readHistory(request)
      }
    } catch {
      if (current(request)) {
        // Recover a receipt saved before a network/cache failure, without a POST.
        try {
          const operation = verify(await ports.readSaved())
          if (current(request))
            update({
              operation,
              contentLoaded: false,
              error: operation ? ACTION_FAILED : NOT_STARTED,
              allowed: operation ? state.allowed : false,
              nextAllowed: false,
            })
        } catch {
          if (current(request)) update({ error: READ_FAILED, allowed: false })
        }
      }
    } finally {
      if (current(request)) update({ busy: false })
    }
  }
  const readHistory = async (request: number) => {
    if (!ports.readHistory) return
    const rows = await ports.readHistory()
    if (rows.length > DICTIONARY_ANALYSIS_HISTORY_LIMIT)
      throw new Error('Shared analysis history exceeds its limit')
    const history = rows.map(row => {
      const parsed = verify(row)!
      if (!parsed.submitted || !isDictionaryAnalysisTerminal(parsed.response))
        throw new Error('Invalid shared analysis history')
      return parsed
    })
    if (current(request)) update({ history })
  }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start(subscribeOwner: (invalidate: () => void) => () => void) {
      const request = ++epoch
      active = true
      if (!invalidated) update(INITIAL)
      const unsubscribe = subscribeOwner(() => {
        if (!active || request !== epoch) return
        invalidated = true
        update({
          loaded: true,
          blocked: true,
          allowed: false,
          nextAllowed: false,
          history: null,
          busy: false,
          operation: null,
          contentLoaded: false,
          error: SESSION_CHANGED,
        })
      })
      if (!invalidated) void initialize(request)
      return () => {
        active = false
        ++epoch
        unsubscribe()
      }
    },
    get assertCurrent() {
      const request = epoch
      return () => {
        if (!current(request)) throw new Error(SESSION_CHANGED)
      }
    },
    submit: () => run('submit'),
    recover: () => run('recover'),
    loadPublished: () => run('load'),
    nextAttempt: () => run('next'),
    async loadHistory() {
      if (!active || invalidated || state.busy) return
      const request = epoch
      update({ busy: true, error: null })
      try {
        await readHistory(request)
      } catch {
        if (current(request)) update({ error: READ_FAILED })
      } finally {
        if (current(request)) update({ busy: false })
      }
    },
  }
}

export function dictionaryAnalysisActionMessage(
  operation: DictionaryAnalysisClientOperation | null
): string | null {
  if (!operation) return null
  if (!operation.submitted) return 'Analysis is ready to send.'
  const response = operation.response
  if (!response) return 'Result not confirmed. Check the saved analysis status.'
  if ('outcome' in response) return 'Another shared analysis is in progress.'
  const messages = {
    accepted: 'Shared analysis is queued.',
    dispatching: 'Shared analysis is running.',
    validating: 'The shared meaning is being checked.',
    published: 'Shared analysis published.',
    'no-change': 'Shared analysis is already current.',
    rejected: 'Analysis was not approved. Existing shared content was kept.',
    'head-conflict': 'Shared content changed before this analysis finished.',
    'authorization-revoked':
      'Permission changed before this analysis completed.',
    'provider-failed': 'Analysis failed. Existing shared content was kept.',
    'provider-outcome-unknown':
      'The result needs review. Existing shared content was kept.',
  }
  return messages[response.status]
}

/** Receipt state alone cannot establish that this view has loaded common content. */
export function isDictionaryAnalysisContentCurrent(
  operation: DictionaryAnalysisClientOperation | null,
  context: {
    wordId: string
    mode?: string
    entryId?: string | null
    revisionId?: string | null
    headSequence?: string | null
  }
): boolean {
  const receipt = operation?.response
  if (
    !operation ||
    !receipt ||
    'outcome' in receipt ||
    !['published', 'no-change'].includes(receipt.status) ||
    !receipt.published_head_sequence ||
    !receipt.published_revision_id ||
    context.wordId !== operation.word_id ||
    context.mode !== 'follow' ||
    context.entryId !== operation.command.entry_id ||
    !context.headSequence
  )
    return false
  const comparison = compareDictionarySequences(
    context.headSequence,
    receipt.published_head_sequence
  )
  return (
    comparison > 0 ||
    (comparison === 0 && context.revisionId === receipt.published_revision_id)
  )
}
