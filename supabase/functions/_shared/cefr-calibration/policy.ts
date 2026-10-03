import {
  type Candidate,
  type Metrics,
  parseCandidate,
  type Rate,
} from './metrics.ts'
import { profileDigest, type AcceptancePolicy } from './profile.ts'
import {
  buildCalibrationReport,
  type CalibrationReport,
  type ReportInputs,
} from './report.ts'
import { digest, objectDigest, text } from './validation.ts'

export interface QualificationApproval {
  fixture_sha256: string
  report_sha256: string
  profile_sha256: string
  policy_sha256: string
  review_ref: string
  provider_reuse_policy_ref: string
}

// Only an in-process token minted after re-evaluation can authorize a decision.
// Serialized reports, client forms and provider claims cannot recreate this token.
export interface QualifiedMethod {
  readonly qualification_sha256: string
}
const qualifiedMethods = new WeakMap<
  QualifiedMethod,
  { profile: string; threshold: number }
>()

const minimum = (metric: Rate, threshold: number): boolean =>
  metric.value !== null && metric.value >= threshold

const passes = (
  metrics: Metrics,
  policy: AcceptancePolicy,
  size: number,
  requireAccepted = true
): boolean =>
  metrics.items >= size &&
  metrics.missing === 0 &&
  metrics.invalid === 0 &&
  minimum(metrics.coverage, policy.minimum_coverage) &&
  metrics.exact.denominator >= policy.minimum_scored_items &&
  minimum(metrics.exact, policy.minimum_exact) &&
  minimum(metrics.within_one, policy.minimum_within_one) &&
  (!requireAccepted ||
    (metrics.accepted_accuracy.denominator >= policy.minimum_accepted_items &&
      minimum(metrics.accepted_accuracy, policy.minimum_accepted_accuracy))) &&
  (metrics.expected_abstention_accuracy.denominator === 0 ||
    minimum(
      metrics.expected_abstention_accuracy,
      policy.minimum_abstention_accuracy
    )) &&
  metrics.severe_errors.value !== null &&
  metrics.severe_errors.value <= policy.maximum_severe_error_rate

export const qualificationBlockers = (report: CalibrationReport): string[] => {
  const blockers: string[] = []
  if (report.fixture_origin !== 'reviewed')
    blockers.push('fixture_not_reviewed')
  if (report.response_provenance.kind !== 'provider')
    blockers.push('fake_responses')
  const policy = report.policy
  if (!policy) return [...blockers, 'no_reviewed_policy']
  for (const [name, split] of Object.entries(report.splits)) {
    if (!passes(split, policy, policy.minimum_items_per_split))
      blockers.push(`${name}_acceptance_failed`)
    for (const slice of policy.required_slices) {
      // Slices expected to abstain need evidence of abstention, not known-label accuracy.
      const metrics = split.slices[slice]
      const ambiguitySlice =
        slice === 'ambiguous' || slice === 'conflicting-examples'
      const abstentionSlice =
        metrics.expected_abstention_accuracy.denominator === metrics.items
      const passed = abstentionSlice
        ? metrics.items >= policy.minimum_items_per_slice &&
          metrics.missing === 0 &&
          metrics.invalid === 0 &&
          metrics.expected_abstention_accuracy.denominator === metrics.items &&
          minimum(
            metrics.expected_abstention_accuracy,
            policy.minimum_abstention_accuracy
          )
        : passes(
            metrics,
            policy,
            policy.minimum_items_per_slice,
            !ambiguitySlice
          )
      if (!passed) blockers.push(`${name}_${slice}_acceptance_failed`)
    }
  }
  return blockers
}

// The approval argument MUST come from a reviewed server-only registry, never an
// HTTP payload or a fixture. No registry or live profile ships with this module.
export const qualifyMethod = async (
  inputs: ReportInputs,
  approval: QualificationApproval | null = null
): Promise<{
  qualified: QualifiedMethod | null
  blockers: string[]
  report: CalibrationReport
}> => {
  approval = structuredClone(approval)
  const report = await buildCalibrationReport(inputs)
  const blockers = qualificationBlockers(report)
  if (!approval) blockers.push('missing_server_approval')
  if (approval) {
    const binding = [
      ['fixture_sha256', report.fixture_sha256],
      ['report_sha256', report.sha256],
      ['profile_sha256', report.profile_sha256],
      ['policy_sha256', report.policy_sha256],
    ] as const
    if (binding.some(([key, expected]) => digest(approval[key]) !== expected))
      blockers.push('approval_binding_mismatch')
    text(approval.review_ref)
    text(approval.provider_reuse_policy_ref)
  }
  if (blockers.length || !approval || !report.policy)
    return { qualified: null, blockers, report }
  const qualified = Object.freeze({
    qualification_sha256: await objectDigest({
      namespace: 'dictionary-cefr-qualification-v1',
      approval,
      profile: report.profile,
      fixture_sha256: report.fixture_sha256,
      held_out_report_sha256: report.sha256,
    }),
  })
  qualifiedMethods.set(qualified, {
    profile: report.profile_sha256,
    threshold: report.policy.confidence_threshold,
  })
  return { qualified, blockers, report }
}

export type CefrDecision =
  | {
      status: 'estimated'
      source: 'model'
      level: Extract<Candidate, { kind: 'known' }>['level']
      confidence: number
      qualification_sha256: string
    }
  | { status: 'unknown' | 'needs_review'; level: null; reason: string }

export const decideCandidate = async (
  raw: unknown,
  context: { profile: unknown; ambiguous: boolean },
  qualification?: QualifiedMethod | null
): Promise<CefrDecision> => {
  const candidate = parseCandidate(raw)
  if (candidate.kind !== 'known')
    return { status: 'unknown', level: null, reason: candidate.kind }
  if (context.ambiguous !== false)
    return { status: 'needs_review', level: null, reason: 'ambiguous_input' }
  const method = qualification ? qualifiedMethods.get(qualification) : undefined
  if (!method)
    return { status: 'needs_review', level: null, reason: 'unqualified_method' }
  let currentDigest: string
  try {
    currentDigest = await profileDigest(context.profile)
  } catch {
    return {
      status: 'needs_review',
      level: null,
      reason: 'unsupported_profile',
    }
  }
  if (method.profile !== currentDigest)
    return { status: 'needs_review', level: null, reason: 'changed_profile' }
  if (candidate.confidence < method.threshold)
    return {
      status: 'needs_review',
      level: null,
      reason: 'below_qualified_threshold',
    }
  return {
    status: 'estimated',
    source: 'model',
    level: candidate.level,
    confidence: candidate.confidence,
    qualification_sha256: qualification!.qualification_sha256,
  }
}
