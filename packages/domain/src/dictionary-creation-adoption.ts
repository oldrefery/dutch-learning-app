import {
  parseCreationJournalRow,
  requireCreationJournalIntent,
  creationPublishedReference,
  type DictionaryCreationJournal,
  type DictionaryCreationJournalRow,
} from './dictionary-creation-journal'
import {
  parseFollowingImportRows,
  parseFollowingImportOperation,
  followingImportRoot,
  type FollowingImportJournal,
  type FollowingImportOperation,
} from './dictionary-following-import-journal'
import {
  createDictionaryFollowingImportClient,
  type FollowingImportRemote,
} from './dictionary-following-import-client'
import {
  withDictionaryCreationOwner,
  type DictionaryCreationOwner,
} from './dictionary-creation-owner'
import type { DictionaryAnalysisAuth } from './dictionary-analysis-owner'
import { canonicalizeJson } from './shared-dictionary'
import {
  requireFollowingImportHydrationState,
  requireFollowingImportHydration,
  type FollowingImportHydrationKind,
} from './dictionary-following-import-hydration'

const MISSING = 'Saved creation adoption is unavailable'
/** Personal adoption is a distinct, idempotent non-provider operation. Its two
 * journals are bridged in order; no receipt or cache/SRS data is fabricated. */
export function createDictionaryCreationAdoptionService(ports: {
  userId: string
  assertCurrent(): void
  signal?: AbortSignal
  enabled(): boolean
  connect(): {
    auth: DictionaryAnalysisAuth
    journal: DictionaryCreationJournal
    imports: FollowingImportJournal
    remote(signal: AbortSignal): FollowingImportRemote
  }
  load(
    value: FollowingImportOperation,
    assertCurrent: () => void,
    kind: FollowingImportHydrationKind
  ): Promise<void>
}) {
  const run = async <T>(
    action: (context: {
      owner: DictionaryCreationOwner
      journal: DictionaryCreationJournal
      imports: FollowingImportJournal
      remote: FollowingImportRemote
      client: ReturnType<typeof createDictionaryFollowingImportClient>
    }) => Promise<T>
  ) => {
    ports.assertCurrent()
    const connection = ports.connect()
    return withDictionaryCreationOwner(
      ports.userId,
      connection.auth,
      ports.assertCurrent,
      owner => {
        const remote = connection.remote(owner.signal)
        return action({
          owner,
          journal: connection.journal,
          imports: connection.imports,
          remote,
          client: createDictionaryFollowingImportClient({
            userId: ports.userId,
            enabled: ports.enabled,
            journal: connection.imports,
            remote,
          }),
        })
      },
      ports.signal
    )
  }
  type Context = Parameters<Parameters<typeof run>[0]>[0]
  const latest = async (
    expected: DictionaryCreationJournalRow,
    context: Context
  ) => {
    const candidate = parseCreationJournalRow(expected)
    if (candidate.session.user_id !== ports.userId) throw new Error(MISSING)
    const row = await context.journal.read(
      ports.userId,
      candidate.session.request.resolution_id,
      context.owner
    )
    context.owner.assert()
    return requireCreationJournalIntent(row ?? undefined, candidate)
  }
  const operation = (
    row: DictionaryCreationJournalRow
  ): FollowingImportOperation => {
    if (!row.adoption) throw new Error(MISSING)
    return parseFollowingImportOperation({
      user_id: ports.userId,
      kind: 'import',
      request: row.adoption.request,
      result: row.adoption.response,
    })
  }
  const savedOperation = async (
    row: DictionaryCreationJournalRow,
    context: Context
  ) => {
    const expected = operation(row)
    const rows = parseFollowingImportRows(
      await context.imports.list(ports.userId),
      ports.userId
    )
    await context.owner.check()
    if (
      rows.some(
        item =>
          item.kind !== 'import' &&
          followingImportRoot(item).operation_id ===
            expected.request.operation_id
      )
    )
      throw new Error(
        'Import recovery changed. Use the saved import recovery page.'
      )
    const saved = rows.find(
      item => item.request.operation_id === expected.request.operation_id
    )
    if (
      !saved ||
      saved.kind !== 'import' ||
      canonicalizeJson(saved.request) !== canonicalizeJson(expected.request)
    )
      throw new Error(MISSING)
    return saved
  }
  const copyReceipt = async (
    row: DictionaryCreationJournalRow,
    saved: FollowingImportOperation,
    context: Context
  ) => {
    if (saved.kind !== 'import' || !saved.result) return row
    if (
      canonicalizeJson(saved.request) !==
      canonicalizeJson(row.adoption?.request)
    )
      throw new Error(MISSING)
    const current = await latest(row, context)
    if (!current.adoption?.submitted)
      throw new Error('Import receipt requires a submitted adoption')
    return context.journal.save(
      current,
      { ...current, adoption: { ...current.adoption, response: saved.result } },
      context.owner
    )
  }
  return {
    prepare(
      expected: DictionaryCreationJournalRow,
      target: { collection_id: string; operation_id: string; word_id: string }
    ) {
      return run(async context => {
        let row = await latest(expected, context)
        const reference = creationPublishedReference(row.session)
        if (!reference)
          throw new Error('A published reference is required before adoption')
        const intent = {
          protocol_version: 2 as const,
          ...target,
          source: { kind: 'published-reference' as const, ...reference },
        }
        if (row.adoption) {
          if (
            canonicalizeJson(row.adoption.request) !== canonicalizeJson(intent)
          )
            throw new Error(
              'Saved import destination and identity are immutable'
            )
          if (row.adoption.submitted) return row
        } else {
          row = await context.journal.save(
            row,
            parseCreationJournalRow({
              ...row,
              adoption: { request: intent, submitted: false, response: null },
            }),
            context.owner
          )
        }
        await context.client.prepare(operation(row), context.owner)
        await context.owner.check()
        return row
      })
    },
    submit(expected: DictionaryCreationJournalRow) {
      return run(async context => {
        const row = await latest(expected, context)
        if (
          canonicalizeJson(row.adoption?.request) !==
          canonicalizeJson(expected.adoption?.request)
        )
          throw new Error(MISSING)
        if (row.adoption?.submitted)
          return copyReceipt(row, await savedOperation(row, context), context)
        // Repair an interrupted bridge before claiming. Creation metadata always
        // precedes the import journal, which precedes the personal RPC.
        await context.client.prepare(operation(row), context.owner)
        const claim = await context.journal.claimAdoption(row, context.owner)
        if (!claim.claimed)
          return copyReceipt(
            claim.row,
            await savedOperation(claim.row, context),
            context
          )
        const delivered = await context.client.deliver(
          operation(claim.row),
          context.owner
        )
        await context.owner.check()
        return copyReceipt(claim.row, delivered, context)
      })
    },
    check(expected: DictionaryCreationJournalRow) {
      return run(async context => {
        const row = await latest(expected, context)
        const saved = await savedOperation(row, context)
        const updated = await copyReceipt(row, saved, context)
        return {
          row: updated,
          state: await context.client.readState(saved, context.owner),
        }
      })
    },
    confirm(expected: DictionaryCreationJournalRow) {
      return run(async context => {
        const row = await latest(expected, context)
        if (!row.adoption?.submitted)
          throw new Error('Only a submitted import may be confirmed')
        const saved = await savedOperation(row, context)
        if (saved.result) return copyReceipt(row, saved, context)
        const state = await context.client.readState(saved, context.owner)
        if (
          state.state === 'cancelled' ||
          state.recovery_version !== 0 ||
          (state.inserted_once &&
            (state.state !== 'active' ||
              state.collection_id !== row.adoption.request.collection_id))
        )
          throw new Error(
            'Import placement changed. Use the saved import recovery page.'
          )
        if (!state.inserted_once) {
          // Explicit replay of the original non-provider import only. Existing
          // availability/server gates still apply when insertion is unconfirmed.
          return copyReceipt(
            row,
            await context.client.deliver(saved, context.owner),
            context
          )
        }
        // A confirmed prior insertion may recover its original immutable receipt
        // with new-work flags OFF. SQL returns the saved receipt before new gates.
        await context.owner.check()
        const reply = await context.remote.rpc(
          'apply_dictionary_import_intent_v2',
          { p_intent: row.adoption.request }
        )
        await context.owner.check()
        if (reply.error) throw reply.error
        const confirmed = await context.imports.save(
          saved,
          reply.data,
          context.owner.assert
        )
        return copyReceipt(row, confirmed, context)
      })
    },
    load(
      expected: DictionaryCreationJournalRow,
      kind: FollowingImportHydrationKind = 'imported'
    ) {
      return run(async context => {
        const row = await latest(expected, context)
        const saved = await savedOperation(row, context)
        const updated = await copyReceipt(row, saved, context)
        if (!updated.adoption?.response)
          throw new Error('Confirm the saved import receipt before loading')
        requireFollowingImportHydration(saved, [saved], kind)
        const assert = () => {
          context.owner.assert()
          ports.assertCurrent()
        }
        await ports.load(saved, assert, kind)
        await context.owner.check()
        // Verify journals after loading too: a concurrent move/cancel/receipt
        // change cannot turn this cache read into UI or batch completion.
        const current = await latest(updated, context)
        const finalOperation = await savedOperation(current, context)
        const finalState = await context.client.readState(
          finalOperation,
          context.owner
        )
        requireFollowingImportHydrationState(finalOperation, finalState, kind)
        if (
          kind === 'imported' &&
          (finalState.recovery_version !== 0 ||
            finalState.collection_id !==
              current.adoption?.request.collection_id)
        )
          throw new Error('Import placement changed during loading')
        assert()
        return current
      })
    },
  }
}
