import { randomUUID } from 'expo-crypto'
import {
  parseDictionaryImportRecoveryState,
  type DictionaryImportIntent,
  type DictionaryImportRecoveryState,
} from '@woordenaar/domain'
import { supabase } from '@/lib/supabase'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { dictionaryImportRecoveryViewRepository as view } from '@/db/dictionaryImportRecoveryViewRepository'
import { dictionaryImportRecoveryRepository as recovery } from '@/db/dictionaryImportRecoveryRepository'
import { changed, requireOrigin } from '@/db/dictionaryImportRecoveryStorage'
import { withDictionaryImportOwner } from './dictionaryImportOwner'

export interface ImportRecoverySnapshot {
  userId: string
  intent: DictionaryImportIntent
  state: DictionaryImportRecoveryState
  previousOperationId: string | null
  localPlacementRevision: number
}

const requireEnabled = () => {
  if (!isDictionaryContentEnabled())
    throw new Error('Dictionary import recovery is unavailable')
}

export const dictionaryImportRecovery = {
  async readCurrent(
    userId: string,
    wordId: string
  ): Promise<ImportRecoverySnapshot> {
    requireEnabled()
    return withDictionaryImportOwner(userId, async owner => {
      const local = await view.readLocal(userId, wordId, owner.assert)
      const intent = requireOrigin(local.delivery)
      const { data, error } = await supabase.rpc(
        'read_dictionary_import_recovery_v1',
        {
          p_intent: intent,
        }
      )
      await owner.check()
      if (error) throw error
      const state = parseDictionaryImportRecoveryState(data, intent)
      const current = await view.readLocal(userId, wordId, owner.assert)
      if (JSON.stringify(current) !== JSON.stringify(local)) changed()
      return {
        userId,
        intent,
        state,
        previousOperationId: local.previousOperationId,
        localPlacementRevision: local.delivery.local_placement_revision,
      }
    })
  },

  async prepare(
    snapshot: ImportRecoverySnapshot,
    targetId: string,
    assertViewOwner: () => void
  ) {
    requireEnabled()
    const state = parseDictionaryImportRecoveryState(
      snapshot.state,
      snapshot.intent
    )
    if (state.state !== 'active' && state.state !== 'uncreated')
      throw new Error(
        'This saved import cannot be recovered. Local data remains saved.'
      )
    return withDictionaryImportOwner(snapshot.userId, async owner => {
      assertViewOwner()
      await recovery.prepare(
        snapshot.userId,
        {
          protocol_version: 1,
          operation_id: randomUUID(),
          original_intent: snapshot.intent,
          expected_recovery_version: state.recovery_version,
          expected_collection_id: state.collection_id,
          target_collection_id: targetId,
        },
        snapshot.previousOperationId,
        () => {
          owner.assert()
          assertViewOwner()
        },
        snapshot.localPlacementRevision
      )
    })
  },
}
