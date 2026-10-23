import {
  parseDictionaryReadContent,
  type DictionaryReadContent,
} from '@woordenaar/domain'
import { isDictionaryFollowingEnabled } from '@/constants/dictionaryContent'
import { dictionaryFollowingRepository } from '@/db/dictionaryFollowingRepository'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import {
  canonicalDictionaryJson,
  parseFollowingHydration,
  type CachedDictionaryEffectiveCard,
} from '@/db/dictionaryFollowingHydration'
import {
  dictionaryModeReconciliationRepository as repository,
  type DictionaryModeLocalSnapshot,
  type DictionaryReviewedModeDecision,
} from '@/db/dictionaryModeReconciliationRepository'
import { randomUUID } from 'expo-crypto'
import { supabase } from '@/lib/supabase'
import { dictionaryFollowingSync } from './dictionaryFollowingSync'
import { withDictionaryOwner } from './dictionaryImportOwner'

export interface DictionaryModeConflictSnapshot {
  kind: 'mode-reconciliation'
  operationId: string
  userId: string
  wordId: string
  localContent: DictionaryReadContent
  remoteContent: DictionaryReadContent
  local: DictionaryModeLocalSnapshot
  remote: CachedDictionaryEffectiveCard
}

export const dictionaryModeReconciliation = {
  async apply(
    snapshot: DictionaryModeConflictSnapshot,
    assertCurrent: () => void = () => {}
  ): Promise<void> {
    const decision: DictionaryReviewedModeDecision = {
      disposition: 'load-server-preserve-local',
      operationId: snapshot.operationId,
      userId: snapshot.userId,
      wordId: snapshot.wordId,
      local: snapshot.local,
      remote: snapshot.remote,
    }
    return withDictionaryOwner(
      snapshot.userId,
      async owner => {
        const guard = () => {
          owner.assert()
          assertCurrent()
        }
        guard()
        if (await repository.isApplied(decision)) {
          guard()
          return
        }
        if (!isDictionaryFollowingEnabled())
          throw new Error('Dictionary following is disabled')
        const local = await repository.read(
          snapshot.userId,
          snapshot.wordId,
          guard
        )
        if (
          canonicalDictionaryJson(local) !==
          canonicalDictionaryJson(snapshot.local)
        )
          throw new Error('Saved content changed. Reload the comparison.')
        await dictionaryFollowingSync.pullForMode(decision, {
          ...owner,
          assert: guard,
          check: async () => {
            await owner.check()
            guard()
          },
        })
        guard()
      },
      'reviewed mode reconciliation'
    )
  },
  /** Preview only: retain originals, pending intents, cache, debt and cursors.
   * The caller cannot use a preview as permission to run a v1 private resolution. */
  async read(
    userId: string,
    wordId: string,
    assertCurrent: () => void = () => {}
  ): Promise<DictionaryModeConflictSnapshot> {
    return withDictionaryOwner(
      userId,
      async owner => {
        const guard = () => {
          owner.assert()
          assertCurrent()
          if (!isDictionaryFollowingEnabled())
            throw new Error('Dictionary following is disabled')
        }
        guard()
        const local = await repository.read(userId, wordId, guard)
        if (local.commands.length === 0 && local.cachedState?.mode !== 'follow')
          throw new Error('No content conflict to resolve')
        const materialized = (
          await dictionaryContentRepository.getMaterializedContent(userId, [
            wordId,
          ])
        ).get(wordId)
        const cached = materialized
          ? undefined
          : (
              await dictionaryFollowingRepository.getCachedCards(userId, [
                wordId,
              ])
            ).get(wordId)
        const localContent = parseDictionaryReadContent(
          materialized?.effective.content ??
            cached?.revision?.content ??
            cached?.card.legacy_content
        )
        if (!localContent.success)
          throw new Error('Saved private content is unavailable')
        await dictionaryFollowingSync.requireAvailability(owner)
        guard()
        const { data, error } = await supabase.rpc(
          'get_dictionary_effective_content_v2',
          {
            p_word_ids: [wordId],
          }
        )
        await owner.check()
        guard()
        if (error) throw error
        const remote = parseFollowingHydration([wordId], [data]).cards.get(
          wordId
        )
        if (!remote) throw new Error('Conflict word is unavailable')
        const remoteContent = parseDictionaryReadContent(
          remote.card.mode === 'follow'
            ? remote.revision?.content
            : remote.card.legacy_content
        )
        if (!remoteContent.success)
          throw new Error('Server content is unavailable')
        const current = await repository.read(userId, wordId, guard)
        if (canonicalDictionaryJson(current) !== canonicalDictionaryJson(local))
          throw new Error('Saved content changed. Reload the comparison.')
        guard()
        return {
          kind: 'mode-reconciliation',
          operationId: randomUUID(),
          userId,
          wordId,
          localContent: localContent.data,
          remoteContent: remoteContent.data,
          local,
          remote,
        }
      },
      'mode reconciliation'
    )
  },
}
