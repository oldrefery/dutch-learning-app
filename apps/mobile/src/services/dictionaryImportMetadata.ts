import { supabase } from '@/lib/supabase'
import type { ImportDelivery } from '@/db/dictionaryImportRecoveryStorage'
import { dictionaryImportDeliveryRepository } from '@/db/dictionaryImportDeliveryRepository'
import type { WordSyncAcknowledgement } from '@/db/wordRepository'

interface MetadataIdentity {
  word_id: string
  user_id: string
  collection_id: string | null
}

function requireRemotePlacement(value: unknown): asserts value is {
  word_id: string
  collection_id: string | null
  updated_at: string
  deleted_at: null
} {
  if (
    !value ||
    typeof value !== 'object' ||
    !('deleted_at' in value) ||
    value.deleted_at !== null ||
    !('updated_at' in value) ||
    typeof value.updated_at !== 'string' ||
    !('collection_id' in value) ||
    !(value.collection_id === null || typeof value.collection_id === 'string')
  )
    throw new Error(
      'Imported personal identity is unavailable. Local queues remain saved.'
    )
}

export async function prepareImportMetadata(
  payloads: readonly MetadataIdentity[],
  deliveries: readonly ImportDelivery[],
  assertOwner: () => void
): Promise<{
  skipIds: Set<string>
  acknowledgements: WordSyncAcknowledgement[]
}> {
  const skipIds = new Set<string>()
  const acknowledgements: WordSyncAcknowledgement[] = []
  const tracked = payloads.filter(payload =>
    deliveries.some(row => row.word_id === payload.word_id)
  )
  for (let offset = 0; offset < tracked.length; offset += 400) {
    const chunk = tracked.slice(offset, offset + 400)
    assertOwner()
    const { data, error } = await supabase
      .from('words')
      .select('word_id,collection_id,updated_at,deleted_at')
      .eq('user_id', chunk[0].user_id)
      .in(
        'word_id',
        chunk.map(row => row.word_id)
      )
      .is('deleted_at', null)
      .range(0, chunk.length - 1)
    assertOwner()
    if (error) throw error
    if (!Array.isArray(data))
      throw new Error('Imported placement lookup failed')
    for (const payload of chunk) {
      const remote = data.find(row => row.word_id === payload.word_id)
      const delivery = deliveries.find(row => row.word_id === payload.word_id)!
      requireRemotePlacement(remote)
      if (
        delivery.cancelled ||
        delivery.original_intent_json === null ||
        delivery.acknowledged_placement_revision === null
      )
        throw new Error(
          'Import placement delivery is unverified. Local queues remain saved.'
        )
      if (
        delivery.local_placement_revision ===
        delivery.acknowledged_placement_revision
      ) {
        skipIds.add(payload.word_id)
        await dictionaryImportDeliveryRepository.hydrateDeliveredPlacement(
          payload.user_id,
          payload.word_id,
          delivery.local_placement_revision,
          remote.collection_id,
          assertOwner
        )
        assertOwner()
        acknowledgements.push({
          word_id: payload.word_id,
          updated_at: remote.updated_at,
          deleted_at: null,
        })
      }
    }
  }
  return { skipIds, acknowledgements }
}
