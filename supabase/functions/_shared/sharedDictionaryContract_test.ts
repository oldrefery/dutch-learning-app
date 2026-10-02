import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  DICTIONARY_CONTENT_PROTOCOL_VERSION,
  parseDictionaryContentCapability,
  resolveInheritedCefr,
} from '../../../packages/domain/src/shared-dictionary.ts'

Deno.test('shared dictionary contract is usable by the Edge runtime', () => {
  assertEquals(
    parseDictionaryContentCapability({
      dictionary_content_protocol: DICTIONARY_CONTENT_PROTOCOL_VERSION,
    }),
    {
      success: true,
      data: {
        dictionary_content_protocol: DICTIONARY_CONTENT_PROTOCOL_VERSION,
      },
    }
  )
  assertEquals(
    resolveInheritedCefr({
      reference: null,
      revision: null,
      overrides: {},
      assessment: null,
    }),
    {
      level: null,
      status: 'unknown',
      reason: 'unlinked-or-missing-revision',
    }
  )
})
