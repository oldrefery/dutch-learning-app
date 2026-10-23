import {
  followingImportRoot,
  followingImportHydrationWordId,
  requireFollowingImportHydrationState,
  type FollowingImportHydrationKind,
  requireFollowingImportHydration,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import { isDictionaryFollowingEnabled } from '@/constants/dictionaryContent'
import { dictionaryFollowingImportRepository as journal } from '@/db/dictionaryFollowingImportRepository'
import { withDictionaryImportOwner } from './dictionaryImportOwner'
import { dictionaryFollowingImportService } from './dictionaryFollowingImportService'
import { dictionaryFollowingSync } from './dictionaryFollowingSync'
import { syncManager } from './syncManager'

/** Explicit loading is independently retryable; receipts/nonces remain durable.
 * No delivery, broad sync, paid operation or receipt-derived SRS is performed. */
async function loadFollowingImportTarget(
  value: FollowingImportOperation,
  assertCurrent: () => void,
  kind: FollowingImportHydrationKind
): Promise<void> {
  await withDictionaryImportOwner(value.user_id, async owner => {
    const assert = () => {
      owner.assert()
      assertCurrent()
      if (!isDictionaryFollowingEnabled())
        throw new Error('Dictionary following is unavailable')
    }
    const guard = {
      assert,
      check: async () => {
        await owner.check()
        const latest = requireFollowingImportHydration(
          value,
          await journal.list(value.user_id),
          kind
        )
        if (JSON.stringify(latest) !== JSON.stringify(operation))
          throw new Error('Import recovery changed during loading')
        assert()
      },
    }
    assert()
    const operation = requireFollowingImportHydration(
      value,
      await journal.list(value.user_id),
      kind
    )
    await dictionaryFollowingSync.requireAvailability(guard)
    const state = await dictionaryFollowingImportService.readState(
      operation,
      assert
    )
    await guard.check()
    requireFollowingImportHydrationState(operation, state, kind)
    await syncManager.pullFollowingImportWord(
      value.user_id,
      followingImportHydrationWordId(operation, kind),
      guard,
      kind === 'existing'
        ? followingImportRoot(operation).source.reference.entry_id
        : undefined
    )
    await guard.check()
    await dictionaryFollowingSync.pullForImport(operation, guard, kind)
    await guard.check()
    if (kind === 'existing') {
      const current = await dictionaryFollowingImportService.readState(
        operation,
        assert
      )
      await guard.check()
      requireFollowingImportHydrationState(operation, current, kind)
    }
  })
}

export const loadFollowingImport = (
  value: FollowingImportOperation,
  assertCurrent: () => void
): Promise<void> => loadFollowingImportTarget(value, assertCurrent, 'imported')

export const loadFollowingExistingCard = (
  value: FollowingImportOperation,
  assertCurrent: () => void
): Promise<void> => loadFollowingImportTarget(value, assertCurrent, 'existing')
