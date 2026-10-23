import {
  parseFollowingTransferRows,
  parseFollowingTransferSession,
  type FollowingTransferSession,
} from './dictionary-following-transfer-journal'
import {
  parseFollowingImportRows,
  followingImportRoot,
  type FollowingImportOperation,
} from './dictionary-following-import-journal'
import type { DictionaryImportRecoveryStateV2 } from './dictionary-following-import-recovery.types'
import { parseDictionaryImportRecoveryStateV2 } from './dictionary-following-import-recovery'

export interface FollowingTransferActionState {
  loaded: boolean
  busy: boolean
  blocked: boolean
  sessions: FollowingTransferSession[]
  operations: FollowingImportOperation[]
  selectedSessionId: string | null
  remoteStates: Record<string, DictionaryImportRecoveryStateV2>
  error: string | null
  loadedImports: Record<string, boolean>
}
const INITIAL: FollowingTransferActionState = {
  loaded: false,
  busy: false,
  blocked: false,
  sessions: [],
  operations: [],
  selectedSessionId: null,
  remoteStates: {},
  error: null,
  loadedImports: {},
}
const SESSION_CHANGED =
  'Your session changed. Reopen the import page to continue.'
const FAILED =
  'Could not finish this action. Any saved documents and requests are retained.'

/** Mounted UI lifetime, not a publication or personal-learning authority. Mount
 * reads local metadata only; every dependency read/dispatch/state read is explicit. */
export function createDictionaryFollowingTransferAction(ports: {
  userId: string
  enabled: () => boolean
  createId: () => string
  list(): Promise<FollowingTransferSession[]>
  listOperations(): Promise<FollowingImportOperation[]>
  prepare(value: FollowingTransferSession): Promise<FollowingTransferSession>
  prepareSource?(
    assertCurrent: () => void
  ): Promise<
    Pick<
      FollowingTransferSession,
      'document' | 'official_pack' | 'shared_collection'
    >
  >
  resolve(sessionId: string): Promise<FollowingTransferSession>
  queueEntry(
    sessionId: string,
    index: number
  ): Promise<FollowingImportOperation>
  deliverEntry(
    sessionId: string,
    index: number
  ): Promise<FollowingImportOperation>
  load?(
    value: FollowingImportOperation,
    assertCurrent: () => void
  ): Promise<void>
  loadExisting?(
    value: FollowingImportOperation,
    assertCurrent: () => void
  ): Promise<void>
  targetCollections?: () => readonly string[]
  prepareOperation?(
    value: FollowingImportOperation,
    assertCurrent: () => void
  ): Promise<FollowingImportOperation>
  deliverOperation?(
    value: FollowingImportOperation,
    assertCurrent: () => void
  ): Promise<FollowingImportOperation>
  readState(
    value: FollowingImportOperation,
    assertCurrent?: () => void
  ): Promise<DictionaryImportRecoveryStateV2>
}) {
  let state = INITIAL
  let epoch = 0
  let active = false
  let invalidated = false
  const listeners = new Set<() => void>()
  const update = (patch: Partial<FollowingTransferActionState>) => {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  const current = (request: number) =>
    active && !invalidated && request === epoch
  const assertCurrent = () => {
    if (!active || invalidated) throw new Error(SESSION_CHANGED)
  }
  const assertRequest = (request: number) => {
    if (!current(request)) throw new Error(SESSION_CHANGED)
  }
  const readLocal = async (request: number) => {
    const sessions = parseFollowingTransferRows(
      await ports.list(),
      ports.userId
    )
    if (!current(request)) return
    const operations = parseFollowingImportRows(
      await ports.listOperations(),
      ports.userId
    )
    if (current(request)) update({ sessions, operations, loaded: true })
  }
  const run = async (action: (request: number) => Promise<void>) => {
    if (!active || invalidated || state.busy) return
    const request = epoch
    update({ busy: true, error: null })
    try {
      await action(request)
    } catch {
      if (current(request)) {
        // Reading durable metadata recovers a local commit/receipt without any RPC.
        try {
          await readLocal(request)
        } catch {
          /* Keep the last valid view. */
        }
        if (current(request)) update({ loaded: true, error: FAILED })
      }
    } finally {
      if (current(request)) update({ busy: false })
    }
  }
  const selected = () => {
    const row = state.sessions.find(
      row => row.session_id === state.selectedSessionId
    )
    if (!row) throw new Error('Choose a saved document')
    return row
  }
  const entry = (index: number) => {
    const row = selected()
    const intent = row.plan?.intents.find(item => item.index === index)?.intent
    if (!intent) throw new Error('This entry requires review')
    return {
      row,
      intent,
      operation: state.operations.find(
        item =>
          item.kind === 'import' &&
          item.request.operation_id === intent.operation_id
      ),
    }
  }
  const requireEnabled = (request: number) => {
    assertRequest(request)
    if (!ports.enabled()) throw new Error('Shared imports are unavailable')
  }
  const related = (operation: FollowingImportOperation) =>
    state.operations.filter(
      item =>
        followingImportRoot(item).operation_id ===
        followingImportRoot(operation).operation_id
    )
  const clearStatus = (rootId: string) => {
    const remoteStates = { ...state.remoteStates }
    delete remoteStates[rootId]
    update({
      remoteStates,
      loadedImports: { ...state.loadedImports, [rootId]: false },
    })
  }
  const sendOperation = async (
    operation: FollowingImportOperation,
    request: number,
    reserve: boolean
  ) => {
    if (!ports.prepareOperation || !ports.deliverOperation)
      throw new Error('Recovery is unavailable')
    const guard = () => assertRequest(request)
    clearStatus(followingImportRoot(operation).operation_id)
    const saved = reserve
      ? await ports.prepareOperation(operation, guard)
      : operation
    guard()
    await ports.deliverOperation(saved, guard)
    guard()
    await readLocal(request)
  }
  const freshEntry = (index: number) => {
    const { operation, intent } = entry(index)
    const remote = state.remoteStates[intent.operation_id]
    if (!operation || !remote || remote.state === 'cancelled')
      throw new Error('Check the saved import status first')
    if (
      related(operation).some(
        item =>
          item.kind === 'cancel' || (item.kind !== 'import' && !item.result)
      )
    )
      throw new Error('Retry the saved operation first')
    return { operation, intent, remote }
  }
  const loadEntry = (index: number, existing: boolean) =>
    run(async request => {
      const { operation, intent } = entry(index)
      const load = existing ? ports.loadExisting : ports.load
      if (!operation || !load) throw new Error('No saved card to load')
      update({
        loadedImports: { ...state.loadedImports, [intent.operation_id]: false },
      })
      await load(operation, () => assertRequest(request))
      assertRequest(request)
      update({
        loadedImports: { ...state.loadedImports, [intent.operation_id]: true },
      })
    })
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    assertCurrent,
    start(subscribeOwner: (invalidate: () => void) => () => void) {
      const request = ++epoch
      active = true
      const unsubscribe = subscribeOwner(() => {
        if (!active || epoch !== request) return
        invalidated = true
        update({
          ...INITIAL,
          loaded: true,
          blocked: true,
          error: SESSION_CHANGED,
        })
      })
      if (!invalidated) {
        update({ busy: false })
        void run(async ticket => {
          await readLocal(ticket)
        })
      }
      return () => {
        active = false
        ++epoch
        unsubscribe()
      }
    },
    reload: () =>
      run(async request => {
        update({ loadedImports: {}, remoteStates: {} })
        await readLocal(request)
      }),
    select(sessionId: string) {
      if (
        !active ||
        invalidated ||
        state.busy ||
        !state.sessions.some(row => row.session_id === sessionId)
      )
        return
      update({ selectedSessionId: sessionId, error: null, remoteStates: {} })
    },
    prepare(
      value: Omit<FollowingTransferSession, 'user_id' | 'session_id' | 'plan'>
    ) {
      return run(async request => {
        requireEnabled(request)
        const source =
          ports.prepareSource &&
          (await ports.prepareSource(() => requireEnabled(request)))
        requireEnabled(request)
        if (
          source &&
          JSON.stringify(
            source.document.entries.map(entry => entry.content)
          ) !==
            JSON.stringify(value.document.entries.map(entry => entry.content))
        )
          throw new Error('Official pack content changed')
        if (
          source &&
          ports.targetCollections &&
          !ports.targetCollections().includes(value.collection_id)
        )
          throw new Error('Choose an available target collection')
        const draft = parseFollowingTransferSession({
          ...value,
          ...source,
          user_id: ports.userId,
          session_id: ports.createId(),
          plan: null,
        })
        const saved = parseFollowingTransferSession(await ports.prepare(draft))
        assertRequest(request)
        if (JSON.stringify(saved) !== JSON.stringify(draft))
          throw new Error('Saved transfer changed')
        await readLocal(request)
        if (current(request)) update({ selectedSessionId: draft.session_id })
      })
    },
    resolve() {
      return run(async request => {
        requireEnabled(request)
        await ports.resolve(selected().session_id)
        assertRequest(request)
        await readLocal(request)
      })
    },
    queue(index: number) {
      return run(async request => {
        requireEnabled(request)
        const { row } = entry(index)
        await ports.queueEntry(row.session_id, index)
        assertRequest(request)
        await readLocal(request)
      })
    },
    deliver(index: number) {
      return run(async request => {
        requireEnabled(request)
        const { row, operation, intent } = entry(index)
        const held = state.operations.some(
          item =>
            item.kind !== 'import' &&
            item.request.original_intent.operation_id === intent.operation_id
        )
        const remote = state.remoteStates[intent.operation_id]
        if (
          held ||
          remote?.state === 'cancelled' ||
          remote?.state === 'unavailable'
        )
          throw new Error('Check the saved import state before continuing')
        clearStatus(intent.operation_id)
        if (!operation) {
          await ports.queueEntry(row.session_id, index)
          requireEnabled(request)
        }
        await ports.deliverEntry(row.session_id, index)
        assertRequest(request)
        await readLocal(request)
      })
    },
    recover(index: number, targetCollectionId: string) {
      return run(async request => {
        const { intent, remote } = freshEntry(index)
        if (
          remote.state === 'unavailable' ||
          !ports.targetCollections?.().includes(targetCollectionId)
        )
          throw new Error('Choose an available owned collection')
        if (!remote.inserted_once) requireEnabled(request)
        await sendOperation(
          {
            user_id: ports.userId,
            kind: 'recover',
            result: null,
            request: {
              protocol_version: 2,
              operation_id: ports.createId(),
              original_intent: intent,
              expected_recovery_version: remote.recovery_version,
              expected_collection_id: remote.collection_id,
              target_collection_id: targetCollectionId,
            },
          },
          request,
          true
        )
      })
    },
    cancel(index: number) {
      return run(async request => {
        const { intent } = freshEntry(index)
        await sendOperation(
          {
            user_id: ports.userId,
            kind: 'cancel',
            result: null,
            request: {
              protocol_version: 2,
              operation_id: ports.createId(),
              original_intent: intent,
            },
          },
          request,
          true
        )
      })
    },
    retryOperation(index: number) {
      return run(async request => {
        const { operation } = entry(index)
        if (!operation) throw new Error('No saved request')
        const pending = related(operation).at(-1)
        if (!pending || pending.kind === 'import' || pending.result)
          throw new Error('No pending recovery or cancellation')
        await sendOperation(pending, request, false)
      })
    },
    load: (index: number) => loadEntry(index, false),
    loadExisting: (index: number) => loadEntry(index, true),
    check(index: number) {
      return run(async request => {
        const { intent, operation } = entry(index)
        if (!operation) throw new Error('No saved request')
        clearStatus(intent.operation_id)
        const value = parseDictionaryImportRecoveryStateV2(
          await ports.readState(operation, () => assertRequest(request)),
          intent
        )
        assertRequest(request)
        update({
          remoteStates: { ...state.remoteStates, [intent.operation_id]: value },
        })
      })
    },
  }
}

export function followingTransferEntryMessage(
  session: FollowingTransferSession,
  index: number,
  operations: readonly FollowingImportOperation[]
): string {
  if (!session.plan) return 'Waiting for reference verification.'
  const review = session.plan.review.find(item => item.index === index)
  if (review)
    return review.reason === 'content-difference'
      ? 'Your content differs from the published meaning. The original is retained for review.'
      : 'The shared meaning could not be verified. The original is retained for review.'
  const intent = session.plan.intents.find(item => item.index === index)?.intent
  if (!intent) return 'Not selected. The original is retained.'
  const related = operations.filter(
    item =>
      (item.kind === 'import' ? item.request : item.request.original_intent)
        .operation_id === intent.operation_id
  )
  const latest = related.at(-1)
  if (!latest) return 'Verified shared meaning. Ready to import.'
  if (latest.kind === 'cancel')
    return latest.result
      ? 'Further import and recovery are cancelled. Existing cards and the original are kept.'
      : 'Cancellation result is unknown. Retry the saved cancellation.'
  if (latest.kind === 'recover') {
    if (!latest.result)
      return 'Recovery result is unknown. Retry the saved recovery.'
    if (latest.result.outcome === 'applied')
      return 'Server confirmed recovery. Load the saved import to use the current card.'
    if (latest.result.outcome === 'identity-conflict')
      return 'A card for this meaning already exists. Existing learning was kept.'
    return latest.result.outcome === 'placement-conflict'
      ? 'The card moved to another collection. Check status before choosing a destination again.'
      : 'The import state changed. Check status before choosing a destination again.'
  }
  if (!latest.result)
    return 'Request saved. Its server result is not confirmed.'
  return latest.result.outcome === 'inserted'
    ? 'Server confirmed the import. Local dictionary loading is still required.'
    : 'A card for this meaning already exists. Existing learning was kept.'
}
