'use client'

import { prepareOfficialFollowingPack } from '@woordenaar/content/dictionary'
import type { OfficialContentManifest } from '@woordenaar/content/manifest'
import {
  parseDictionaryCollectionExportV2,
  withDictionaryAnalysisOwner,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@woordenaar/supabase-contracts'

type MappingDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      get_official_dictionary_mapping_v1: {
        Args: { p_pack_id: string; p_version: string }
        Returns: Json
      }
    }
  }
}

const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(bytes), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

export function prepareOfficialFollowingImport(
  userId: string,
  manifest: OfficialContentManifest,
  enabled: boolean,
  assertCurrent: () => void
) {
  const client = createClient()
  return withDictionaryAnalysisOwner(
    userId,
    client.auth,
    async owner => {
      const assert = () => {
        owner.assert()
        assertCurrent()
        if (
          !enabled ||
          process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED !==
            'true'
        )
          throw new Error('Following pack imports are unavailable')
      }
      assert()
      const target = client as unknown as SupabaseClient<MappingDatabase>
      const { data, error } = await target.rpc(
        'get_official_dictionary_mapping_v1',
        {
          p_pack_id: manifest.pack_id,
          p_version: manifest.version,
        }
      )
      assert()
      if (error) throw error
      const source = await prepareOfficialFollowingPack(manifest, data, sha256)
      await owner.check()
      assert()
      return {
        ...source,
        document: parseDictionaryCollectionExportV2(source.document),
      }
    },
    'official pack import'
  )
}
