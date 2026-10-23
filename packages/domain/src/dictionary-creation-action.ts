import type { createDictionaryCreationAdoptionService } from './dictionary-creation-adoption'
import type { DictionaryImportRecoveryStateV2 } from './dictionary-following-import-recovery.types'
import type { createDictionaryCreationService } from './dictionary-creation-sdk'
import {
  parseCreationJournalRow,
  parseCreationJournalRows,
  creationPublishedReference,
  type DictionaryCreationJournalRow,
} from './dictionary-creation-journal'
import { normalizeDictionaryMeaningQuery } from './dictionary-meaning-lookup'

export type DictionaryCreationService = ReturnType<
  typeof createDictionaryCreationService
>
export interface DictionaryCreationActionState {
  loaded: boolean
  busy: boolean
  blocked: boolean
  rows: DictionaryCreationJournalRow[]
  selectedId: string | null
  error: string | null
  importStates: Record<string, DictionaryImportRecoveryStateV2>
  loadedImports: Record<string, boolean>
}
const INITIAL: DictionaryCreationActionState = {
  loaded: false,
  busy: false,
  blocked: false,
  rows: [],
  selectedId: null,
  error: null,
  importStates: {},
  loadedImports: {},
}
const CHANGED = 'Your session changed. Reopen this page to continue.'
const FAILED =
  'Could not finish this action. Saved requests are retained. Load saved requests before continuing.'
const sameQuery = (left: string, right: string) => {
  try {
    return (
      normalizeDictionaryMeaningQuery(left) ===
      normalizeDictionaryMeaningQuery(right)
    )
  } catch {
    return left === right
  }
}

/** Explicit UI actions only. Mount restores local intent; it never resolves,
 * submits, retries, adopts a personal card or reads a provider result. */
export function createDictionaryCreationAction(ports: {
  userId: string
  originalQuery: string
  createId(): string
  enabled(): boolean
  adoption?: {
    enabled(): boolean
    targetCollections(): readonly string[]
    connect(
      assertCurrent: () => void,
      signal: AbortSignal
    ): ReturnType<typeof createDictionaryCreationAdoptionService>
    onLoaded?(
      row: DictionaryCreationJournalRow,
      assertCurrent: () => void
    ): void | Promise<void>
  }
  connect(
    assertCurrent: () => void,
    signal: AbortSignal
  ): DictionaryCreationService
}) {
  let state = INITIAL
  let active = false
  let invalidated = false
  let epoch = 0
  let lifetime = new AbortController()
  const listeners = new Set<() => void>()
  const update = (patch: Partial<DictionaryCreationActionState>) => {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  const current = (started: number) =>
    active && !invalidated && started === epoch && !lifetime.signal.aborted
  const service = (started: number) =>
    ports.connect(() => {
      if (!current(started)) throw new Error(CHANGED)
    }, lifetime.signal)
  const readLocal = async (started: number, sdk: DictionaryCreationService) => {
    const rows = parseCreationJournalRows(await sdk.list(), ports.userId)
    if (!current(started)) throw new Error(CHANGED)
    const selectedId = rows.some(
      row => row.session.request.resolution_id === state.selectedId
    )
      ? state.selectedId
      : (rows.find(row =>
          sameQuery(row.session.request.original_query, ports.originalQuery)
        )?.session.request.resolution_id ?? null)
    update({ rows, selectedId, loaded: true })
  }
  const run = async (
    action: (sdk: DictionaryCreationService, started: number) => Promise<void>
  ) => {
    if (!active || invalidated || state.busy) return
    const started = epoch
    update({ busy: true, error: null })
    try {
      await action(service(started), started)
    } catch {
      if (current(started)) {
        // A durable claim/receipt can commit even if its reply was lost. Recover
        // metadata only. Failure to read leaves all new work disabled.
        update({ loaded: false })
        try {
          await readLocal(started, service(started))
        } catch {
          /* Preserve the last view, with new work disabled. */
        }
        if (current(started)) update({ error: FAILED })
      }
    } finally {
      if (current(started)) update({ busy: false })
    }
  }
  const selected = () => {
    if (!state.loaded) throw new Error('Load saved requests first')
    const row = state.rows.find(
      row => row.session.request.resolution_id === state.selectedId
    )
    if (!row) throw new Error('Choose a saved request')
    return row
  }
  const retain = (value: DictionaryCreationJournalRow, started: number) => {
    const row = parseCreationJournalRow(value)
    if (!current(started) || row.session.user_id !== ports.userId)
      throw new Error(CHANGED)
    update({
      rows: [
        ...state.rows.filter(
          item =>
            item.session.request.resolution_id !==
            row.session.request.resolution_id
        ),
        row,
      ],
      selectedId: row.session.request.resolution_id,
    })
  }
  const requireNewWork = () => {
    if (!state.loaded || !ports.enabled())
      throw new Error('New shared meaning requests are unavailable')
  }
  const adoptionService = (started: number) => {
    if (!ports.adoption) throw new Error('Shared adoption is unavailable')
    return ports.adoption.connect(() => {
      if (!current(started)) throw new Error(CHANGED)
    }, lifetime.signal)
  }
  const clearLoaded = (id: string) =>
    update({ loadedImports: { ...state.loadedImports, [id]: false } })
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
      active = true
      epoch += 1
      lifetime = new AbortController()
      update({ ...INITIAL, blocked: invalidated })
      const unsubscribe = subscribeOwner(() => {
        invalidated = true
        epoch += 1
        lifetime.abort()
        update({ ...INITIAL, blocked: true, error: CHANGED })
      })
      if (!invalidated) void run((sdk, started) => readLocal(started, sdk))
      return () => {
        active = false
        epoch += 1
        lifetime.abort()
        unsubscribe()
      }
    },
    restore: () => run((sdk, started) => readLocal(started, sdk)),
    select(id: string) {
      if (!active || invalidated || state.busy || !state.loaded) return
      if (state.rows.some(row => row.session.request.resolution_id === id))
        update({ selectedId: id, error: null })
    },
    resolveNew: (hint: string) =>
      run(async (sdk, started) => {
        requireNewWork()
        // Re-read under fresh Auth immediately before minting any intent. Query
        // variants and changed hints cannot bypass a retained same-word request.
        await readLocal(started, sdk)
        requireNewWork()
        if (
          state.rows.some(row =>
            sameQuery(row.session.request.original_query, ports.originalQuery)
          )
        )
          throw new Error('Continue the saved request for this word')
        const row = parseCreationJournalRow({
          protocol_version: 1,
          owner_epoch: ports.createId(),
          session_epoch: ports.createId(),
          session: {
            user_id: ports.userId,
            request: {
              protocol_version: 2,
              resolution_id: ports.createId(),
              original_query: ports.originalQuery,
              meaning_hint: hint,
            },
            resolution: null,
            command: null,
            submitted: false,
            response: null,
          },
          adoption: null,
        })
        // Hold original intent before the await. A failed durable read cannot
        // expose an empty new-attempt form.
        retain(row, started)
        retain(await sdk.resolve(row), started)
      }),
    resolveSaved: () =>
      run(async (sdk, started) => {
        requireNewWork()
        const row = selected()
        if (
          row.session.resolution ||
          row.session.command ||
          row.session.submitted
        )
          throw new Error('This request already has a resolution')
        retain(await sdk.resolve(row), started)
      }),
    create: () =>
      run(async (sdk, started) => {
        requireNewWork()
        let row = selected()
        if (
          row.session.submitted ||
          row.session.resolution?.outcome !== 'new-meaning'
        )
          throw new Error('This request requires status or review')
        if (!row.session.command) {
          row = await sdk.prepareCommand(row, ports.createId())
          retain(row, started)
        }
        // Cancellation between preparation and dispatch must retain the command.
        if (!current(started)) throw new Error(CHANGED)
        retain(await sdk.submit(row), started)
      }),
    adopt: (collectionId: string) =>
      run(async (_sdk, started) => {
        if (
          !ports.adoption?.enabled() ||
          !state.loaded ||
          !ports.adoption.targetCollections().includes(collectionId)
        )
          throw new Error(
            'Choose an owned collection with shared imports enabled'
          )
        let row = selected()
        const id = row.session.request.resolution_id
        clearLoaded(id)
        const imports = adoptionService(started)
        if (!row.adoption) {
          row = await imports.prepare(row, {
            collection_id: collectionId,
            operation_id: ports.createId(),
            word_id: ports.createId(),
          })
          retain(row, started)
        } else if (row.adoption.request.collection_id !== collectionId) {
          throw new Error('Continue the saved import destination')
        }
        if (!row.adoption) throw new Error('Prepared adoption is unavailable')
        if (row.adoption.submitted)
          throw new Error('Confirm the saved import first')
        retain(await imports.submit(row), started)
      }),
    checkImport: () =>
      run(async (_sdk, started) => {
        const row = selected(),
          id = row.session.request.resolution_id
        clearLoaded(id)
        const result = await adoptionService(started).check(row)
        retain(result.row, started)
        update({ importStates: { ...state.importStates, [id]: result.state } })
      }),
    confirmImport: () =>
      run(async (_sdk, started) => {
        const row = selected(),
          id = row.session.request.resolution_id
        clearLoaded(id)
        retain(await adoptionService(started).confirm(row), started)
      }),
    loadImport: (existing = false) =>
      run(async (_sdk, started) => {
        const row = selected(),
          id = row.session.request.resolution_id
        clearLoaded(id)
        const result = await adoptionService(started).load(
          row,
          existing ? 'existing' : 'imported'
        )
        retain(result, started)
        if (!existing)
          await ports.adoption?.onLoaded?.(result, () => {
            if (!current(started)) throw new Error(CHANGED)
          })
        if (!current(started)) throw new Error(CHANGED)
        update({ loadedImports: { ...state.loadedImports, [id]: true } })
      }),
    checkStatus: () =>
      run(async (sdk, started) => {
        const row = selected()
        const id = row.session.request.resolution_id
        const result = row.session.submitted
          ? await sdk.recover(id)
          : await sdk.recoverResolution(id)
        if (!result) throw new Error('Saved request is unavailable')
        retain(result, started)
      }),
  }
}

export const dictionaryCreationMessage = (
  row: DictionaryCreationJournalRow
) => {
  const { session } = row
  if (creationPublishedReference(session))
    return 'This meaning is published. Adding it to your collection is a separate action.'
  if (session.submitted) {
    const reply = session.response
    if (!reply)
      return 'The request was sent. Check its status; do not send it again.'
    if ('outcome' in reply)
      return 'Another request is creating this meaning. Check status later.'
    switch (reply.status) {
      case 'provider-outcome-unknown':
        return 'The result is not yet known. Check status later; this request will not be sent again.'
      case 'review-required':
        return 'This result needs review before publication.'
      case 'rejected':
        return 'This result was rejected. Nothing was added to your collection.'
      case 'identity-conflict':
        return 'The meaning identity needs review.'
      case 'authorization-revoked':
        return 'Creation permission changed. Nothing was added to your collection.'
      case 'provider-failed':
        return 'Creation failed. Any further attempt requires reviewed recovery.'
      default:
        return 'The shared meaning is being prepared. Check status later.'
    }
  }
  switch (session.resolution?.outcome) {
    case 'new-meaning':
      return 'The meaning is resolved. You may request shared creation when permitted.'
    case 'review-required':
      return 'This meaning needs review before creation.'
    case 'rejected':
      return 'This meaning could not be approved for creation.'
    default:
      return 'Meaning resolution is pending. Continue the saved request or check its status.'
  }
}
