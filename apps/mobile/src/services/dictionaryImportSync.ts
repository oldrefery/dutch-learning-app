import { supabase, wordService } from '@/lib/supabase'
import { dictionaryImportRepository } from '@/db/dictionaryImportRepository'
import { parseDictionaryImportReceipt } from '@woordenaar/domain'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { randomUUID } from 'expo-crypto'

import { dictionaryImportRecoverySync } from './dictionaryImportRecoverySync'
import { withDictionaryImportOwner } from './dictionaryImportOwner'
import { DictionaryImportConflictError } from './dictionaryImportErrors'
export { DictionaryImportConflictError } from './dictionaryImportErrors'

const ensureOwner = async (userId: string): Promise<void> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (data.user?.id !== userId) {
    throw new Error('Authentication changed during dictionary import')
  }
}

export const dictionaryImportSync = {
  async retryConflict(userId: string, wordId: string): Promise<void> {
    if (!isDictionaryContentEnabled())
      throw new Error('Dictionary imports are unavailable')
    await ensureOwner(userId)
    const pending = (await dictionaryImportRepository.getPending(userId)).find(
      row => row.intent.word_id === wordId && row.status === 'conflict'
    )
    if (!pending) throw new Error('Import conflict changed. Reload the word.')
    const content = pending.intent.source.content
    const existing = await wordService.checkWordExists(
      userId,
      content.dutch_lemma,
      content.part_of_speech ?? undefined,
      content.article ?? undefined
    )
    if (existing) {
      throw new DictionaryImportConflictError(
        'The other card still exists. Manage that card on the device where it was saved, then retry here. Your local card and learning history remain saved.'
      )
    }
    await ensureOwner(userId)
    await dictionaryImportRepository.retryConflict(
      userId,
      pending.intent,
      randomUUID()
    )
  },
  async push(userId: string): Promise<number> {
    if (!isDictionaryContentEnabled()) return 0
    await ensureOwner(userId)
    const recovered = await dictionaryImportRecoverySync.push(userId)
    const pending = await dictionaryImportRepository.getPending(userId)
    return withDictionaryImportOwner(userId, async owner => {
      let count = recovered
      for (const row of pending) {
        if (row.status === 'conflict') {
          throw new DictionaryImportConflictError(
            'Import conflicts need resolution. Your local cards, private edits and learning history are saved on this device.'
          )
        }
        await owner.check()
        const { data, error } = await supabase.rpc(
          'apply_dictionary_import_intent_v1',
          {
            p_intent: row.intent,
          }
        )
        await owner.check()
        if (error) {
          await dictionaryImportRepository.markError(
            userId,
            row.intent.operation_id,
            error.message,
            owner.assert
          )
          throw error
        }
        const receipt = parseDictionaryImportReceipt(data, row.intent)
        await ensureOwner(userId)
        await dictionaryImportRepository.acceptReceipt(
          userId,
          row.intent,
          receipt,
          owner.assert
        )
        if (receipt.outcome === 'identity-conflict') {
          throw new DictionaryImportConflictError(
            'Import conflicts need resolution. Your local cards, private edits and learning history are saved on this device.'
          )
        }
        count++
      }
      return count
    })
  },
}
