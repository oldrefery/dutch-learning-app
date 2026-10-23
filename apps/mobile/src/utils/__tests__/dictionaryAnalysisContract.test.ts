import {
  DICTIONARY_ANALYSIS_STATUSES,
  parseDictionaryAnalysisAcceptanceV2,
  parseDictionaryAnalysisCommandV2,
  parseDictionaryAnalysisReceiptV2,
} from '@woordenaar/domain'

const command = {
  protocol_version: 2,
  operation_id: '11111111-1111-4111-8111-111111111111',
  entry_id: '22222222-2222-4222-8222-222222222222',
  expected_revision_id: '33333333-3333-4333-8333-333333333333',
  expected_head_sequence: '9007199254740993',
}
const receipt = {
  ...command,
  fence: '9007199254740994',
  status: 'accepted',
  quota_charged: true,
  result_sha256: null,
  error_code: null,
  published_revision_id: null,
  published_head_sequence: null,
}
const resultHash = 'a'.repeat(64)
const UNKNOWN = 'provider-outcome-unknown'

describe('shared analysis commands and durable receipts', () => {
  it('preserves full BIGINT precision in expected heads and fences', () => {
    expect(parseDictionaryAnalysisCommandV2(command)).toEqual({
      success: true,
      data: command,
    })
    expect(parseDictionaryAnalysisReceiptV2(receipt)).toEqual({
      success: true,
      data: receipt,
    })
  })
  it.each([
    { ...command, actor_id: command.entry_id },
    { ...command, private_content: {} },
    { ...command, prompt: 'private original' },
    { ...command, protocol_version: 1 },
    { ...command, expected_head_sequence: 9007199254740993 },
    { ...command, expected_head_sequence: '01' },
    { ...command, expected_head_sequence: '-1' },
    { ...command, expected_head_sequence: '9223372036854775808' },
    { ...command, operation_id: 'not-a-uuid' },
  ])('rejects unsupported command inputs %p', input => {
    expect(parseDictionaryAnalysisCommandV2(input).success).toBe(false)
  })
  it('accepts every supported lifecycle status with consistent result/error/publication dependencies', () => {
    for (const status of DICTIONARY_ANALYSIS_STATUSES) {
      const completed = status === 'published' || status === 'no-change'
      const failed = [
        'rejected',
        'head-conflict',
        'authorization-revoked',
        'provider-failed',
        UNKNOWN,
      ].includes(status)
      expect(
        parseDictionaryAnalysisReceiptV2({
          ...receipt,
          status,
          result_sha256: ['validating', 'published', 'no-change'].includes(
            status
          )
            ? resultHash
            : null,
          error_code: failed ? 'recorded-failure' : null,
          published_revision_id: completed
            ? command.expected_revision_id
            : null,
          published_head_sequence: completed
            ? command.expected_head_sequence
            : null,
        }).success
      ).toBe(true)
    }
  })
  it.each([
    { ...receipt, status: 'complete' },
    { ...receipt, actor_id: command.entry_id },
    { ...receipt, provider_result: {} },
    { ...receipt, quota_charged: false },
    { ...receipt, fence: '0' },
    { ...receipt, result_sha256: resultHash },
    { ...receipt, status: 'validating' },
    { ...receipt, status: UNKNOWN },
    { ...receipt, error_code: 'private provider response' },
    { ...receipt, published_revision_id: command.expected_revision_id },
    { ...receipt, status: 'published', result_sha256: resultHash },
    { ...receipt, status: 'validating', result_sha256: 'invalid' },
  ])('rejects inconsistent or leaking receipts %p', input => {
    expect(parseDictionaryAnalysisReceiptV2(input).success).toBe(false)
  })
  it('accepts busy outcomes without inventing a paid attempt or receipt', () => {
    const busy = { protocol_version: 2, outcome: 'analysis-in-progress' }
    expect(parseDictionaryAnalysisAcceptanceV2(busy)).toEqual({
      success: true,
      data: busy,
    })
    expect(
      parseDictionaryAnalysisAcceptanceV2({ ...busy, quota_charged: true })
        .success
    ).toBe(false)
    expect(
      parseDictionaryAnalysisAcceptanceV2({
        ...busy,
        outcome: 'provider-result',
      }).success
    ).toBe(false)
    expect(parseDictionaryAnalysisAcceptanceV2(receipt)).toEqual({
      success: true,
      data: receipt,
    })
  })
  it('allows a quarantined late result without granting a published revision', () => {
    const late = {
      ...receipt,
      status: UNKNOWN,
      result_sha256: resultHash,
      error_code: 'late-provider-result',
    }
    expect(parseDictionaryAnalysisReceiptV2(late)).toEqual({
      success: true,
      data: late,
    })
  })
})
