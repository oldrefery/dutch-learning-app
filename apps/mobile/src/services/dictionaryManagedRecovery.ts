import { isDictionaryManagedRecoveryEnabled } from '@/constants/dictionaryContent'
import { supabase } from '@/lib/supabase'
import {
  dictionaryFollowingRepository as following,
  type DictionaryHydrationRequest,
} from '@/db/dictionaryFollowingRepository'
import { dictionaryModeReconciliationRepository as modes } from '@/db/dictionaryModeReconciliationRepository'
import { parseFollowingHydration } from '@/db/dictionaryFollowingHydration'
import {
  managedRecoveryDecision,
  parseManagedRecoveries,
} from '@/db/dictionaryManagedRecovery'
import type { DictionaryEffectiveBatchV2 } from '@woordenaar/domain'
import type { DictionaryOwnerGuard } from './dictionaryImportOwner'

/** Recovery is authorized by an administrator's completed restore receipt, not
 * by an ordinary legacy response. Missing support leaves the existing guard intact. */
export async function recoverManagedDictionaryModes(
  request: DictionaryHydrationRequest,
  batches: readonly DictionaryEffectiveBatchV2[],
  owner: DictionaryOwnerGuard
): Promise<number> {
  owner.assert()
  if (!isDictionaryManagedRecoveryEnabled()) return 0
  const remote = parseFollowingHydration(request.wordIds, batches).cards
  const cached = await following.getCachedCards(request.userId, request.wordIds)
  const ids = [...remote]
    .filter(
      ([id, value]) =>
        value.card.mode === 'legacy' && cached.get(id)?.card.mode === 'follow'
    )
    .map(([id]) => id)
  if (ids.length === 0) return 0
  let recovered = 0
  for (let offset = 0; offset < ids.length; offset += 1000) {
    const chunk = ids.slice(offset, offset + 1000)
    const { data, error } = await supabase.rpc(
      'get_dictionary_managed_recoveries_v1',
      { p_word_ids: chunk }
    )
    await owner.check()
    owner.assert()
    if (error?.code === 'PGRST202' || error?.code === '42883') return recovered
    if (error) throw error
    const receipts = parseManagedRecoveries(data, request.userId, chunk)
    for (const receipt of receipts) {
      const fresh = remote.get(receipt.word_id)
      if (!fresh) throw new Error('Managed recovery card is unavailable')
      const local = await modes.read(
        request.userId,
        receipt.word_id,
        owner.assert
      )
      const decision = managedRecoveryDecision(receipt, local, fresh)
      owner.assert()
      const single = { ...request, wordIds: [receipt.word_id] }
      await following.commitReviewedMode(
        decision,
        single,
        [
          {
            protocol_version: 2,
            watermark: fresh.watermark,
            cards: [fresh.card],
            revisions: [],
          },
        ],
        owner.assert
      )
      recovered++
    }
  }
  return recovered
}
