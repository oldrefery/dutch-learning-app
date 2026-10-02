import { supabase } from '@/lib/supabase'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import {
  parseDictionaryImportCancellationReceipt,
  parseDictionaryImportRecoveryResult,
  parseDictionaryImportRecovery,
} from '@woordenaar/domain'
import { dictionaryImportRecoveryRepository } from '@/db/dictionaryImportRecoveryRepository'
import { dictionaryImportCancellationRepository } from '@/db/dictionaryImportCancellationRepository'
import { dictionaryImportDeletionRepository } from '@/db/dictionaryImportDeletionRepository'
import { acceptDictionaryImportRecovery } from '@/db/dictionaryImportRecoveryAcknowledgement'
import { withDictionaryImportOwner } from './dictionaryImportOwner'
import {
  getImportErrorMessage,
  DictionaryImportConflictError,
} from './dictionaryImportErrors'

export class DictionaryImportRecoveryError extends DictionaryImportConflictError {
  constructor(
    readonly outcome:
      'identity-conflict' | 'state-conflict' | 'placement-conflict'
  ) {
    super(
      `Import recovery requires attention (${outcome}). Your local card and learning history remain saved.`
    )
  }
}

type PendingRecovery = Awaited<
  ReturnType<typeof dictionaryImportRecoveryRepository.getPending>
>[number]
type Owner = { assert: () => void; check: () => Promise<void> }

async function acceptResult(
  userId: string,
  row: PendingRecovery,
  data: unknown,
  owner: Owner
) {
  if (row.kind === 'recovery') {
    const request = parseDictionaryImportRecovery(row.request)
    const result = parseDictionaryImportRecoveryResult(data, request)
    await acceptDictionaryImportRecovery(userId, request, result, owner.assert)
    if (result.outcome !== 'applied')
      throw new DictionaryImportRecoveryError(result.outcome)
  } else {
    const result = parseDictionaryImportCancellationReceipt(data, row.request)
    await dictionaryImportCancellationRepository.accept(
      userId,
      row.request,
      result,
      owner.assert
    )
  }
}

async function deliver(userId: string, row: PendingRecovery, owner: Owner) {
  if (row.status !== 'pending' && row.status !== 'error')
    throw new DictionaryImportRecoveryError(row.status)
  await owner.check()
  try {
    const { data, error } = await supabase.rpc(
      row.kind === 'cancel'
        ? 'cancel_dictionary_import_v1'
        : 'recover_dictionary_import_v1',
      { p_request: row.request }
    )
    await owner.check()
    if (error) throw error
    await acceptResult(userId, row, data, owner)
  } catch (error) {
    if (error instanceof DictionaryImportRecoveryError) throw error
    await owner.check()
    await dictionaryImportRecoveryRepository.markError(
      userId,
      row.request,
      getImportErrorMessage(error),
      owner.assert
    )
    throw error
  }
}

export const dictionaryImportRecoverySync = {
  async push(userId: string, cancellationsOnly = false): Promise<number> {
    if (!isDictionaryContentEnabled()) return 0
    return withDictionaryImportOwner(userId, async owner => {
      await dictionaryImportDeletionRepository.queueRetainedTombstones(
        userId,
        owner.assert
      )
      const pending =
        await dictionaryImportRecoveryRepository.getPending(userId)
      const ordered = [
        ...pending.filter(row => row.kind === 'cancel'),
        ...pending.filter(row => row.kind === 'recovery' && !cancellationsOnly),
      ]
      for (const row of ordered) await deliver(userId, row, owner)
      return ordered.length
    })
  },
}
