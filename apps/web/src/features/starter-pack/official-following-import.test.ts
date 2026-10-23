/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { prepareOfficialFollowingImport } from './official-following-import'
import { createClient } from '@/lib/supabase/client'
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const rpc = jest.fn()
const invoke = () =>
  prepareOfficialFollowingImport(OWNER, manifest, true, guard)
import { createHash } from 'node:crypto'
import bundled from '@woordenaar/content'
import {
  validateOfficialContentManifest,
  canonicalizeOfficialContent,
} from '@woordenaar/content/manifest'
import {
  officialEntryToDictionaryContent,
  officialFollowingDocument,
  prepareOfficialFollowingPack,
} from '@woordenaar/content/dictionary'
import {
  canonicalizeCefrInput,
  decideFollowingTransferRows,
  parseFollowingTransferSession,
  prepareFollowingTransferRows,
  parseDictionaryContent,
  type DictionaryRevision,
} from '@woordenaar/domain'

const OWNER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const SESSION = '33333333-3333-4333-8333-333333333333'
const ENTRY = '44444444-4444-4444-8444-444444444444'
const REVISION = '55555555-5555-4555-8555-555555555555'
const OPERATION = '66666666-6666-4666-8666-666666666666'
const WORD = '77777777-7777-4777-8777-777777777777'
const OFFLINE = 'Offline'
const INVALID_PACK = 'Invalid following official pack'
const sha = async (value: string) =>
  createHash('sha256').update(value).digest('hex')
const parsed = validateOfficialContentManifest(bundled)
if (!parsed.success) throw new Error('Invalid official fixture')
const manifest = parsed.data
const mapping = async () => {
  const content = officialEntryToDictionaryContent(manifest.entries[0])
  return {
    schema_version: 1 as const,
    pack_id: manifest.pack_id,
    version: manifest.version,
    manifest_sha256: await sha(canonicalizeOfficialContent(manifest)),
    entries: [
      {
        pack_entry_id: manifest.entries[0].entry_id,
        reference: { entry_id: ENTRY, revision_id: REVISION },
        revision_content_sha256: await sha(
          canonicalizeOfficialContent(content)
        ),
        revision: {
          revision_no: 1,
          schema_version: 1 as const,
          cefr_input_sha256: await sha(canonicalizeCefrInput(content)),
        },
        provenance: {
          source_id: OTHER,
          provenance_locator: 'synthetic-reviewed-source',
        },
      },
    ],
  }
}
let callback: (event: string, session: { user: { id: string } } | null) => void
const getUser = jest.fn()
const unsubscribe = jest.fn()
const onAuthStateChange = jest.fn((fn: typeof callback) => {
  callback = fn
  return { data: { subscription: { unsubscribe } } }
})
let current = true
const guard = () => {
  if (!current) throw new Error('Unmounted')
}

beforeEach(() => {
  jest.clearAllMocks()
  current = true
  getUser.mockResolvedValue({ data: { user: { id: OWNER } }, error: null })
  process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
  jest
    .mocked(createClient)
    .mockReturnValue({ rpc, auth: { getUser, onAuthStateChange } } as never)
})
afterEach(() => {
  delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
})

it('is read-only and binds every stable pack entry before explicit document reservation', async () => {
  const receipt = await mapping()
  rpc.mockResolvedValue({ data: receipt, error: null })
  const before = JSON.stringify(manifest)
  const source = await invoke()
  expect(source.document.entries).toHaveLength(manifest.entries.length)
  expect(source.official_pack.entry_ids).toEqual(
    manifest.entries.map(entry => entry.entry_id)
  )
  expect(source.official_pack.manifest_sha256).toBe(receipt.manifest_sha256)
  expect(source.document.entries[0].shared_reference).toEqual({
    reference: receipt.entries[0].reference,
    content_sha256: receipt.entries[0].revision_content_sha256,
  })
  expect(source.document.entries[1].shared_reference).toBeNull()
  expect(JSON.stringify(manifest)).toBe(before)
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('get_official_dictionary_mapping_v1', {
    p_pack_id: manifest.pack_id,
    p_version: manifest.version,
  })
  expect(unsubscribe).toHaveBeenCalled()
})

it.each(['pack_id', 'version', 'manifest_sha256'] as const)(
  'rejects mismatched mapping %s before any journal or personal write',
  async field => {
    const receipt = await mapping()
    receipt[field] = field === 'manifest_sha256' ? 'f'.repeat(64) : 'wrong'
    rpc.mockResolvedValue({ data: receipt, error: null })
    await expect(invoke()).rejects.toThrow('does not match')
  }
)
it('rejects a forged mapped content hash and an unapproved manifest', async () => {
  const receipt = await mapping()
  receipt.entries[0].revision_content_sha256 = 'f'.repeat(64)
  rpc.mockResolvedValue({ data: receipt, error: null })
  await expect(invoke()).rejects.toThrow('content does not match')
  await expect(
    prepareOfficialFollowingPack(
      {
        ...manifest,
        content_review: { ...manifest.content_review, status: 'pending' },
      },
      null,
      sha
    )
  ).rejects.toThrow('approved')
})
it('retains a complete original without reference hints when mapping is withdrawn or absent', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  const source = await invoke()
  expect(source.document).toEqual(officialFollowingDocument(manifest))
  expect(source.official_pack.entry_ids).toEqual(
    manifest.entries.map(entry => entry.entry_id)
  )
})
it.each(['owner', 'aba', 'unmount', 'gate'] as const)(
  'fences preparation across %s changes while reading the mapping',
  async change => {
    const receipt = await mapping()
    rpc.mockImplementation(async () => {
      if (change === 'owner')
        getUser.mockResolvedValue({
          data: { user: { id: OTHER } },
          error: null,
        })
      if (change === 'aba') {
        callback('SIGNED_IN', { user: { id: OTHER } })
        callback('SIGNED_IN', { user: { id: OWNER } })
      }
      if (change === 'unmount') current = false
      if (change === 'gate')
        delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
      return { data: receipt, error: null }
    })
    await expect(invoke()).rejects.toThrow()
    expect(unsubscribe).toHaveBeenCalled()
  }
)
it('rejects another authenticated owner before the mapping read', async () => {
  getUser.mockResolvedValue({ data: { user: { id: OTHER } }, error: null })
  await expect(invoke()).rejects.toThrow('Authentication changed')
  expect(rpc).not.toHaveBeenCalled()
})
it('keeps network failures retryable without preparing an import', async () => {
  rpc.mockResolvedValue({ data: null, error: new Error(OFFLINE) })
  await expect(invoke()).rejects.toThrow(OFFLINE)
  const receipt = await mapping()
  rpc.mockResolvedValue({ data: receipt, error: null })
  await expect(invoke()).resolves.toHaveProperty(
    'official_pack.pack_id',
    manifest.pack_id
  )
})

it('keeps pack identity, exact selection and source nonces immutable across restart', async () => {
  const receipt = await mapping()
  const source = await prepareOfficialFollowingPack(manifest, receipt, sha)
  const draft = parseFollowingTransferSession({
    ...source,
    user_id: OWNER,
    session_id: SESSION,
    collection_id: OTHER,
    selected_indexes: [1, 0],
    plan: null,
  })
  let rows = prepareFollowingTransferRows([], draft)
  const content = parseDictionaryContent(
    officialEntryToDictionaryContent(manifest.entries[0])
  )
  if (!content.success) throw new Error('Invalid content fixture')
  const revision: DictionaryRevision = {
    ...receipt.entries[0].revision,
    ...receipt.entries[0].reference,
    content: content.data,
    content_sha256: receipt.entries[0].revision_content_sha256,
    review_status: 'published',
  }
  rows = decideFollowingTransferRows(
    rows,
    draft,
    [revision],
    jest.fn().mockReturnValueOnce(OPERATION).mockReturnValueOnce(WORD)
  )
  const restored = parseFollowingTransferSession(
    JSON.parse(JSON.stringify(rows[0]))
  )
  expect(restored.plan?.intents[0].intent.source).toEqual({
    kind: 'official-pack',
    pack_id: manifest.pack_id,
    version: manifest.version,
    pack_entry_id: manifest.entries[0].entry_id,
    manifest_sha256: receipt.manifest_sha256,
    reference: receipt.entries[0].reference,
    content_sha256: receipt.entries[0].revision_content_sha256,
  })
  expect(restored.plan?.review).toEqual([
    { index: 1, reason: 'unresolved-reference' },
  ])
  expect(restored.document).toEqual(draft.document)
  expect(restored.plan?.intents[0].intent).not.toHaveProperty('interval_days')
  expect(
    decideFollowingTransferRows([restored], restored, [], () => {
      throw new Error('No new nonce')
    })
  ).toEqual([restored])
  expect(() =>
    prepareFollowingTransferRows(rows, {
      ...draft,
      official_pack: { ...draft.official_pack!, version: '2.0.0' },
    })
  ).toThrow('immutable')
})
it.each(['entry-order', 'duplicate-entry', 'missing-entry', 'hash'] as const)(
  'rejects corrupted saved provenance: %s',
  async failure => {
    const source = await prepareOfficialFollowingPack(
      manifest,
      await mapping(),
      sha
    )
    const draft = parseFollowingTransferSession({
      ...source,
      user_id: OWNER,
      session_id: SESSION,
      collection_id: OTHER,
      selected_indexes: [0],
      plan: null,
    })
    if (failure === 'entry-order') {
      const revision = {
        ...draft.official_pack!,
        entry_ids: draft.official_pack!.entry_ids.slice().reverse(),
      }
      expect(() =>
        prepareFollowingTransferRows([draft], {
          ...draft,
          official_pack: revision,
        })
      ).toThrow('immutable')
      return
    }
    const pack = {
      ...draft.official_pack!,
      entry_ids: draft.official_pack!.entry_ids.slice(),
    }
    if (failure === 'duplicate-entry') pack.entry_ids[1] = pack.entry_ids[0]
    if (failure === 'missing-entry') pack.entry_ids.pop()
    if (failure === 'hash') pack.manifest_sha256 = 'invalid'
    expect(() =>
      parseFollowingTransferSession({ ...draft, official_pack: pack })
    ).toThrow(INVALID_PACK)
  }
)
it('keeps withdrawn published references unresolved without a spelling fallback', async () => {
  const source = await prepareOfficialFollowingPack(
    manifest,
    await mapping(),
    sha
  )
  const draft = parseFollowingTransferSession({
    ...source,
    user_id: OWNER,
    session_id: SESSION,
    collection_id: OTHER,
    selected_indexes: [0],
    plan: null,
  })
  const rows = decideFollowingTransferRows([draft], draft, [], () => {
    throw new Error('No nonce for review')
  })
  expect(rows[0].plan?.intents).toEqual([])
  expect(rows[0].plan?.review).toEqual([
    { index: 0, reason: 'unresolved-reference' },
  ])
})
