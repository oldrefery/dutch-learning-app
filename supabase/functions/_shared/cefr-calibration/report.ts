import {
  type CalibrationFixture,
  type FixtureItem,
  REQUIRED_SLICES,
  validateFixture,
} from './fixture.ts'
import { parseCandidate, score, summarize } from './metrics.ts'
import { validatePolicy, validateProfile } from './profile.ts'
import {
  digest,
  list,
  objectDigest,
  record,
  requireValid,
  text,
} from './validation.ts'

export const requestDigest = (
  fixture: CalibrationFixture,
  profileSha256: string
): Promise<string> =>
  objectDigest({
    namespace: 'dictionary-cefr-request-v1',
    fixture_sha256: fixture.sha256,
    profile_sha256: profileSha256,
    items: fixture.items.map(item => ({
      id: item.id,
      input_sha256: item.input_sha256,
    })),
  })

const validateResponses = (
  value: unknown,
  items: FixtureItem[],
  requestSha: string,
  profileSha: string
) => {
  const raw = record(value)
  requireValid(
    raw.request_sha256 === requestSha && raw.profile_sha256 === profileSha,
    'response_binding'
  )
  const provenance = record(raw.provenance)
  requireValid(
    provenance.kind === 'fake' || provenance.kind === 'provider',
    'response_origin'
  )
  const responses = new Map<string, unknown>()
  const responseIds = new Set<string>()
  const expected = new Map(items.map(item => [item.id, item.input_sha256]))
  for (const value of list(raw.responses)) {
    const response = record(value)
    const id = text(response.id)
    requireValid(expected.has(id), 'unexpected_response_id')
    requireValid(!responses.has(id), 'duplicate_response_id')
    requireValid(
      digest(response.input_sha256) === expected.get(id),
      'response_input_mismatch'
    )
    const responseId = text(response.response_id)
    requireValid(!responseIds.has(responseId), 'duplicate_provider_response_id')
    responseIds.add(responseId)
    requireValid(
      Object.hasOwn(response, 'candidate'),
      'response_candidate_required'
    )
    responses.set(id, response.candidate)
  }
  return {
    responses,
    provenance: { kind: provenance.kind, run_id: text(provenance.run_id) },
  }
}

export interface ReportInputs {
  fixture: unknown
  profile: unknown
  policy: unknown
  responses: unknown
}

export const buildCalibrationReport = async (input: ReportInputs) => {
  // Snapshot before async hashing so caller mutations cannot change evidence mid-flight.
  const snapshot = structuredClone(input)
  const fixture = await validateFixture(snapshot.fixture)
  const profile = validateProfile(snapshot.profile)
  const policy =
    snapshot.policy === null ? null : validatePolicy(snapshot.policy)
  const profileSha = await objectDigest(profile)
  const requestSha = await requestDigest(fixture, profileSha)
  const batch = validateResponses(
    snapshot.responses,
    fixture.items,
    requestSha,
    profileSha
  )
  const rows = fixture.items.map(item =>
    score(
      item,
      parseCandidate(batch.responses.get(item.id)),
      policy?.confidence_threshold ?? null
    )
  )
  const bins = policy?.confidence_bins ?? []
  const splits = Object.fromEntries(
    (['calibration', 'held_out'] as const).map(split => {
      const selected = rows.filter(row => row.item.split === split)
      return [
        split,
        {
          ...summarize(selected, bins),
          slices: Object.fromEntries(
            REQUIRED_SLICES.map(slice => [
              slice,
              summarize(
                selected.filter(row => row.item.slices.includes(slice)),
                bins
              ),
            ])
          ),
        },
      ]
    })
  )
  const report = {
    namespace: 'dictionary-cefr-report-v1' as const,
    fixture_sha256: fixture.sha256,
    fixture_revision: fixture.revision,
    fixture_origin: fixture.origin,
    profile_sha256: profileSha,
    profile,
    request_sha256: requestSha,
    policy_sha256: policy === null ? null : await objectDigest(policy),
    policy,
    response_sha256: await objectDigest(snapshot.responses),
    response_provenance: batch.provenance,
    interpretation:
      fixture.origin === 'synthetic' || batch.provenance.kind === 'fake'
        ? 'synthetic_mechanics_only'
        : 'unqualified_observations',
    total: summarize(rows, bins),
    splits,
    items: rows.map(row => ({
      id: row.item.id,
      input_sha256: row.item.input_sha256,
      split: row.item.split,
      candidate_kind: row.candidate.kind,
      distance: row.distance,
      would_accept_at_proposed_threshold: row.accepted,
    })),
  }
  return { ...report, sha256: await objectDigest(report) }
}

export type CalibrationReport = Awaited<
  ReturnType<typeof buildCalibrationReport>
>
