import { parseDictionaryReadContent } from '@woordenaar/domain'
import { requireFollowingValue } from '../dictionaryFollowingHydration'
import {
  managedRecoveryDecision,
  parseManagedRecoveries,
} from '../dictionaryManagedRecovery'
import type { ManagedRecovery } from '../dictionaryManagedRecovery'
import type { DictionaryModeLocalSnapshot } from '../dictionaryModeReconciliationRepository'
import type { CachedDictionaryEffectiveCard } from '../dictionaryFollowingHydration'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  ENTRY,
  REVISION_1,
  REVISION_2,
  followingContent as writeContent,
} from './dictionaryFollowing.fixture'

const followingContent = requireFollowingValue(
  parseDictionaryReadContent(writeContent)
)

const receipt = (): ManagedRecovery => ({
  run_id: WORD_A2,
  operation_id: REVISION_2,
  user_id: OWNER_A,
  word_id: WORD_A,
  entry_id: ENTRY,
  revision_id: REVISION_1,
  from_version: '9007199254740992',
  to_version: '9007199254740993',
  original_content: followingContent,
  published_content: followingContent,
  restored_content: followingContent,
})
const local = (): DictionaryModeLocalSnapshot => ({
  word: { word_id: WORD_A, user_id: OWNER_A, collection_id: null },
  wordContent: { ...followingContent },
  privateState: null,
  cachedState: {
    mode: 'follow',
    entry_id: ENTRY,
    revision_id: REVISION_1,
    content_version: '9007199254740992',
  },
  privateRevision: null,
  cachedRevision: null,
  requiredState: null,
  commands: [],
})
const remote = (): CachedDictionaryEffectiveCard => ({
  watermark: '9007199254740999',
  revision: null,
  card: {
    word_id: WORD_A,
    mode: 'legacy',
    content_version: '9007199254740993',
    reference: null,
    adopted_revision_id: null,
    head_sequence: null,
    legacy_content: followingContent,
    removed_fields: [],
    cefr: { level: null, status: 'unknown', confidence: null },
  },
})
const parse = (items: unknown[]) =>
  parseManagedRecoveries({ protocol_version: 1, recoveries: items }, OWNER_A, [
    WORD_A,
  ])
it('requires an exact owner-bound receipt and preserves bigint versions', () => {
  expect(parse([receipt()])).toEqual([receipt()])
  expect(
    managedRecoveryDecision(receipt(), local(), remote()).managedRecovery
  ).toEqual(receipt())
})
it.each([
  'user_id',
  'word_id',
  'entry_id',
  'revision_id',
  'from_version',
  'to_version',
] as const)('rejects a mismatched %s', key => {
  const changed = {
    ...receipt(),
    [key]: key.endsWith('version') ? '6' : OWNER_B,
  }
  expect(() => managedRecoveryDecision(changed, local(), remote())).toThrow()
})
it('rejects wrong owner, duplicates, foreign IDs and non-successor versions at parsing', () => {
  for (const values of [
    [{ ...receipt(), user_id: OWNER_B }],
    [receipt(), receipt()],
    [{ ...receipt(), word_id: WORD_A2 }],
    [{ ...receipt(), to_version: '9007199254740994' }],
  ])
    expect(() => parse(values)).toThrow()
})
it('rejects ordinary legacy content that differs from the completed restore receipt', () => {
  const value = remote()
  if (value.card.mode === 'legacy')
    value.card.legacy_content = {
      ...followingContent,
      analysis_notes: 'New server text',
    }
  expect(() => managedRecoveryDecision(receipt(), local(), value)).toThrow()
})
it('does not discard pending content commands or private overrides', () => {
  const queued = local()
  queued.commands = [{ operation_id: WORD_A2 }]
  expect(() => managedRecoveryDecision(receipt(), queued, remote())).toThrow()
  const overridden = local()
  overridden.privateState = {
    overrides_json: '{"analysis_notes":{"op":"set","value":"new"}}',
  }
  expect(() =>
    managedRecoveryDecision(receipt(), overridden, remote())
  ).toThrow()
})
it('preserves a newer local analysis even when there is no pending command', () => {
  const changed = local()
  changed.wordContent.analysis_notes = 'Unsent personal edit'
  expect(() => managedRecoveryDecision(receipt(), changed, remote())).toThrow(
    'newer local analysis'
  )
})
it('compares SQLite JSON/boolean encodings without changing text', () => {
  const stored = local()
  stored.wordContent.translations = JSON.stringify(
    followingContent.translations
  )
  stored.wordContent.is_separable = 0
  expect(managedRecoveryDecision(receipt(), stored, remote()).wordId).toBe(
    WORD_A
  )
})
