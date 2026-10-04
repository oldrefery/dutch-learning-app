import {
  parseDictionaryImportCancellation,
  parseDictionaryImportCancellationReceipt,
  parseDictionaryImportRecovery,
  parseDictionaryImportRecoveryResult,
  parseDictionaryImportRecoveryState,
  type DictionaryImportRecovery,
} from '@woordenaar/domain'
import { createMockWord } from '@/__tests__/helpers/factories'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'

const ROOT = '10000000-0000-4000-8000-000000000001'
const WORD = '20000000-0000-4000-8000-000000000001'
const TARGET = '30000000-0000-4000-8000-000000000001'
const OPERATION = '40000000-0000-4000-8000-000000000001'
const DUPLICATE = '50000000-0000-4000-8000-000000000001'
const original = {
  protocol_version: 1 as const,
  operation_id: ROOT,
  word_id: WORD,
  collection_id: TARGET,
  source: {
    kind: 'private-copy' as const,
    content: wordToDictionaryContent(createMockWord()),
  },
}
const request: DictionaryImportRecovery = {
  protocol_version: 1,
  operation_id: OPERATION,
  original_intent: original,
  expected_recovery_version: 0,
  expected_collection_id: null,
  target_collection_id: TARGET,
}
const state = {
  protocol_version: 1,
  original_operation_id: ROOT,
  word_id: WORD,
  recovery_version: 1,
  inserted_once: true,
  state: 'active',
  collection_id: TARGET,
}
const receipt = {
  protocol_version: 1,
  operation_id: OPERATION,
  original_operation_id: ROOT,
  word_id: WORD,
  target_collection_id: TARGET,
  outcome: 'applied',
  existing_word_id: null,
  recovery_version: 1,
  idempotent: false,
}
const cancellation = {
  protocol_version: 1 as const,
  operation_id: OPERATION,
  original_intent: original,
}

it('retains exact immutable original input, nullable placement and bounded generation', () => {
  expect(parseDictionaryImportRecovery(request)).toEqual(request)
  expect(parseDictionaryImportCancellation(cancellation)).toEqual(cancellation)
  for (const version of [0, 2147483647]) {
    expect(
      parseDictionaryImportRecovery({
        ...request,
        expected_recovery_version: version,
      }).expected_recovery_version
    ).toBe(version)
  }
})

it.each([-1, 1.5, NaN, Infinity, 2147483648, '1'])(
  'rejects invalid recovery version %s',
  version => {
    expect(() =>
      parseDictionaryImportRecovery({
        ...request,
        expected_recovery_version: version,
      })
    ).toThrow()
  }
)

it('rejects extra/missing keys, learning input, invalid source and original-nonce reuse', () => {
  const { expected_collection_id: omitted, ...missing } = request
  expect(omitted).toBeNull()
  for (const value of [
    missing,
    { ...request, interval_days: 37 },
    { ...request, operation_id: ROOT },
    { ...request, expected_collection_id: undefined },
    { ...request, target_collection_id: 'foreign' },
    {
      ...request,
      original_intent: {
        ...original,
        source: { ...original.source, word_id: WORD },
      },
    },
  ]) {
    expect(() => parseDictionaryImportRecovery(value)).toThrow()
  }
  expect(() =>
    parseDictionaryImportCancellation({
      ...cancellation,
      target_collection_id: TARGET,
    })
  ).toThrow()
})

it('binds applied/conflict replay to operation, original root, personal ID, chosen target and next generation', () => {
  expect(parseDictionaryImportRecoveryResult(receipt, request)).toEqual(receipt)
  expect(
    parseDictionaryImportRecoveryResult(
      { ...receipt, idempotent: true },
      request
    )
  ).toMatchObject({ idempotent: true })
  expect(
    parseDictionaryImportRecoveryResult(
      { ...receipt, outcome: 'identity-conflict', existing_word_id: DUPLICATE },
      request
    )
  ).toMatchObject({ existing_word_id: DUPLICATE })
  for (const change of [
    { operation_id: ROOT },
    { original_operation_id: OPERATION },
    { word_id: DUPLICATE },
    { target_collection_id: DUPLICATE },
    { recovery_version: 0 },
    { recovery_version: 2 },
    { idempotent: 1 },
    { outcome: 'identity-conflict', existing_word_id: WORD },
    { outcome: 'applied', existing_word_id: DUPLICATE },
    { extra: true },
  ]) {
    expect(() =>
      parseDictionaryImportRecoveryResult({ ...receipt, ...change }, request)
    ).toThrow()
  }
})

it('distinguishes nonmutating version/placement conflicts from accepted receipts', () => {
  const identity = {
    protocol_version: 1,
    operation_id: OPERATION,
    original_operation_id: ROOT,
    word_id: WORD,
    target_collection_id: TARGET,
  }
  const conflict = { ...identity, outcome: 'state-conflict', state }
  expect(parseDictionaryImportRecoveryResult(conflict, request)).toEqual(
    conflict
  )
  const placement = {
    ...identity,
    outcome: 'placement-conflict',
    state: { ...state, recovery_version: 0 },
  }
  expect(parseDictionaryImportRecoveryResult(placement, request)).toEqual(
    placement
  )
  expect(() =>
    parseDictionaryImportRecoveryResult(
      { ...conflict, idempotent: true },
      request
    )
  ).toThrow()
  expect(() =>
    parseDictionaryImportRecoveryResult(
      { ...conflict, state: { ...state, recovery_version: 0 } },
      request
    )
  ).toThrow()
  expect(() =>
    parseDictionaryImportRecoveryResult(
      {
        ...placement,
        state: { ...state, recovery_version: 0, collection_id: null },
      },
      request
    )
  ).toThrow()
})

it('rejects inconsistent snapshots and binds cancellation acknowledgement without a target/SRS claim', () => {
  expect(parseDictionaryImportRecoveryState(state, original)).toEqual(state)
  for (const change of [
    { word_id: DUPLICATE },
    { inserted_once: false },
    { state: 'uncreated' },
    { state: ['active'] },
    { state: 'unavailable' },
    { recovery_version: -1 },
    { state: 'cancelled', recovery_version: 0 },
    { extra: true },
  ]) {
    expect(() =>
      parseDictionaryImportRecoveryState({ ...state, ...change }, original)
    ).toThrow()
  }
  const cancelled = {
    protocol_version: 1,
    operation_id: OPERATION,
    original_operation_id: ROOT,
    word_id: WORD,
    outcome: 'cancelled',
    recovery_version: 2,
    idempotent: true,
  }
  expect(
    parseDictionaryImportCancellationReceipt(cancelled, cancellation)
  ).toEqual(cancelled)
  for (const change of [
    { operation_id: ROOT },
    { outcome: 'applied' },
    { recovery_version: 0 },
    { target_collection_id: TARGET },
  ]) {
    expect(() =>
      parseDictionaryImportCancellationReceipt(
        { ...cancelled, ...change },
        cancellation
      )
    ).toThrow()
  }
})
