import type { OfficialContentManifest } from './manifest'
import {
  canonicalizeOfficialContent,
  OfficialContentValidationError,
  validateOfficialContentManifest,
} from './manifest'

export interface OfficialContentCatalogItem {
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  description: string
  displayOrder: number
  entryCount: number
  packId: string
  publishedAt: string
  slug: string
  title: string
  version: string
}

export interface RemoteOfficialContentVersion {
  contentSha256: string
  manifest: unknown
  packId: string
  version: string
}

export type Sha256 = (canonicalJson: string) => Promise<string>

export { canonicalizeOfficialContent } from './manifest'

export async function verifyRemoteOfficialContentVersion(
  remote: RemoteOfficialContentVersion,
  sha256: Sha256
): Promise<OfficialContentManifest> {
  if (!/^[0-9a-f]{64}$/.test(remote.contentSha256)) {
    throw new Error('Official content has an invalid SHA-256 digest.')
  }

  const validation = validateOfficialContentManifest(remote.manifest)
  if (!validation.success) {
    throw new OfficialContentValidationError(validation.issues)
  }
  if (
    validation.data.pack_id !== remote.packId ||
    validation.data.version !== remote.version
  ) {
    throw new Error(
      'Official content identity does not match its catalog entry.'
    )
  }
  if (validation.data.content_review.status !== 'approved') {
    throw new Error('Official content has not completed editorial review.')
  }

  const actualDigest = (
    await sha256(canonicalizeOfficialContent(validation.data))
  ).toLowerCase()
  if (actualDigest !== remote.contentSha256) {
    throw new Error('Official content integrity verification failed.')
  }

  return validation.data
}
