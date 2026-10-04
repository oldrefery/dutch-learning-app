import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@woordenaar/supabase-contracts'
import {
  parseDictionaryContentCommand,
  parseDictionaryContentOverrides,
} from '@woordenaar/domain'
import type {
  DictionaryContentCommand,
  DictionaryContentOverrides,
} from '@woordenaar/domain'

type WriteDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      word_content_state: {
        Row: {
          word_id: string
          user_id: string
          content_version: number
          overrides: Json
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Functions: Database['public']['Functions'] & {
      apply_dictionary_content_command_v1: {
        Args: { p_command: Json }
        Returns: Json
      }
    }
  }
}

export const staleContentMessage =
  'This word changed since you opened it. Reload the page before trying again.'

export const readDictionaryWriteState = async (
  client: SupabaseClient<Database>,
  userId: string,
  wordId: string,
  formData: FormData
): Promise<{ version: number; overrides: DictionaryContentOverrides }> => {
  const supplied = formData.get('contentVersion')
  if (
    typeof supplied !== 'string' ||
    !/^\d+$/.test(supplied) ||
    !Number.isSafeInteger(Number(supplied))
  ) {
    throw new Error(staleContentMessage)
  }
  const dictionaryClient = client as unknown as SupabaseClient<WriteDatabase>
  const { data, error } = await dictionaryClient
    .from('word_content_state')
    .select('word_id, user_id, content_version, overrides')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .maybeSingle()
  if (error) throw new Error('Could not verify the word content. Please retry.')
  if (data && (data.user_id !== userId || data.word_id !== wordId))
    throw new Error('Could not verify the word content.')
  const version = data?.content_version ?? 0
  if (
    !Number.isSafeInteger(version) ||
    version < 0 ||
    version !== Number(supplied)
  )
    throw new Error(staleContentMessage)
  const overrides = parseDictionaryContentOverrides(data?.overrides ?? {})
  if (!overrides.success)
    throw new Error('Could not verify private changes. Please retry.')
  return { version, overrides: overrides.data }
}

export const applyDictionaryCommand = async (
  client: SupabaseClient<Database>,
  command: DictionaryContentCommand
): Promise<void> => {
  const parsed = parseDictionaryContentCommand(command)
  if (!parsed.success)
    throw new Error(
      'The content change is invalid. Please reload and try again.'
    )
  const dictionaryClient = client as unknown as SupabaseClient<WriteDatabase>
  const { data, error } = await dictionaryClient.rpc(
    'apply_dictionary_content_command_v1',
    {
      p_command: JSON.parse(JSON.stringify(parsed.data)) as Json,
    }
  )
  if (error) {
    if (error.message.includes('stale-content-version'))
      throw new Error(staleContentMessage)
    if (error.message.includes('semantic-key-conflict'))
      throw new Error(
        'This meaning already exists in your vocabulary. Your word was not changed.'
      )
    throw new Error(
      'Could not confirm the content change. Reload the page to check the result before retrying.'
    )
  }
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    data.protocol_version !== 1 ||
    data.word_id !== command.word_id ||
    data.operation_id !== command.operation_id ||
    data.kind !== command.kind ||
    data.content_version !== command.expected_content_version + 1
  ) {
    throw new Error(
      'Could not confirm the content change. Reload the page to check the result.'
    )
  }
}
