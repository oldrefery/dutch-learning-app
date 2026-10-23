import {
  compareDictionarySequences,
  parseDictionaryContentCommand,
  type DictionaryContentCommand,
} from '@woordenaar/domain'
import type { getDatabase } from './initDB'
import {
  canonicalDictionaryJson,
  requireFollowingValue,
  type CachedDictionaryEffectiveCard,
} from './dictionaryFollowingHydration'

/** Commands reach this boundary only after strict v1 receipt validation by sync.
 * Delete matching intents in the same transaction as the complete v2 result cache;
 * any remaining private command makes that entire transaction roll back. */
export const acknowledgeFollowingCommands = async (
  transaction: Awaited<ReturnType<typeof getDatabase>>,
  userId: string,
  cards: ReadonlyMap<string, CachedDictionaryEffectiveCard>,
  commands: readonly DictionaryContentCommand[]
): Promise<void> => {
  if (
    commands.length > 10000 ||
    new Set(commands.map(command => command.operation_id)).size !==
      commands.length
  )
    throw new Error('Invalid dictionary receipt acknowledgement batch')
  for (const value of commands) {
    const command = requireFollowingValue(parseDictionaryContentCommand(value))
    const card = cards.get(command.word_id)?.card
    if (
      !card ||
      compareDictionarySequences(
        card.content_version,
        String(BigInt(command.expected_content_version) + BigInt(1))
      ) < 0
    )
      throw new Error('Dictionary command result is incomplete')
    const pending = await transaction.getFirstAsync<{
      payload_json: string
      status: string
    }>(
      'SELECT payload_json, status FROM dictionary_content_commands WHERE user_id = ? AND word_id = ? AND operation_id = ?',
      [userId, command.word_id, command.operation_id]
    )
    if (
      pending &&
      (pending.status === 'conflict' ||
        canonicalDictionaryJson(
          requireFollowingValue(
            parseDictionaryContentCommand(
              JSON.parse(pending.payload_json) as unknown
            )
          )
        ) !== canonicalDictionaryJson(command))
    )
      throw new Error('Dictionary command changed before acknowledgement')
    await transaction.runAsync(
      'DELETE FROM dictionary_content_commands WHERE user_id = ? AND word_id = ? AND operation_id = ?',
      userId,
      command.word_id,
      command.operation_id
    )
  }
}
