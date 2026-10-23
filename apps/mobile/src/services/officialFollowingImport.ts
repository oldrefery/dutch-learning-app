import * as Crypto from 'expo-crypto'
import { prepareOfficialFollowingPack } from '@woordenaar/content/dictionary'
import type { OfficialContentManifest } from '@woordenaar/content/manifest'
import { parseDictionaryCollectionExportV2 } from '@woordenaar/domain'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { officialContentCatalogService } from './officialContentCatalogService'
import { withDictionaryImportOwner } from './dictionaryImportOwner'

export const prepareOfficialFollowingImport = (
  userId: string,
  manifest: OfficialContentManifest,
  assertCurrent: () => void
) =>
  withDictionaryImportOwner(userId, async owner => {
    const assert = () => {
      owner.assert()
      assertCurrent()
      if (!isDictionaryFollowingImportsEnabled())
        throw new Error('Following pack imports are unavailable')
    }
    assert()
    const mapping =
      await officialContentCatalogService.getDictionaryMapping(manifest)
    assert()
    const source = await prepareOfficialFollowingPack(
      manifest,
      mapping,
      value =>
        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)
    )
    await owner.check()
    assert()
    return {
      ...source,
      document: parseDictionaryCollectionExportV2(source.document),
    }
  })
