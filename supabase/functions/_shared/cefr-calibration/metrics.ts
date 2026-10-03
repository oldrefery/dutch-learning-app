import {
  CEFR_LEVELS,
  type CefrLevel,
} from '../../../../packages/domain/src/shared-dictionary.ts'
import type { FixtureItem } from './fixture.ts'

export type Candidate =
  | { kind: 'known'; level: CefrLevel; confidence: number }
  | { kind: 'abstain' | 'invalid' | 'missing' }

export const parseCandidate = (value: unknown): Candidate => {
  if (value === undefined) return { kind: 'missing' }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { kind: 'invalid' }
  const raw = value as Record<string, unknown>
  if (raw.level === null && raw.confidence === null) return { kind: 'abstain' }
  if (
    !CEFR_LEVELS.includes(raw.level as CefrLevel) ||
    typeof raw.confidence !== 'number' ||
    !Number.isFinite(raw.confidence) ||
    raw.confidence < 0 ||
    raw.confidence > 1
  )
    return { kind: 'invalid' }
  // Provider status/source/hash claims never acquire authority here.
  return {
    kind: 'known',
    level: raw.level as CefrLevel,
    confidence: raw.confidence,
  }
}

export interface Rate {
  numerator: number
  denominator: number
  value: number | null
}
export const rate = (numerator: number, denominator: number): Rate => ({
  numerator,
  denominator,
  value: denominator === 0 ? null : numerator / denominator,
})

export interface ScoredItem {
  item: FixtureItem
  candidate: Candidate
  distance: number | null
  accepted: boolean
}

export const score = (
  item: FixtureItem,
  candidate: Candidate,
  threshold: number | null
): ScoredItem => {
  const distance =
    candidate.kind === 'known' && item.expectation.kind === 'levels'
      ? Math.min(
          ...item.expectation.levels.map(level =>
            Math.abs(
              CEFR_LEVELS.indexOf(level) - CEFR_LEVELS.indexOf(candidate.level)
            )
          )
        )
      : null
  return {
    item,
    candidate,
    distance,
    accepted:
      candidate.kind === 'known' &&
      threshold !== null &&
      !item.ambiguous &&
      candidate.confidence >= threshold,
  }
}

export const summarize = (rows: ScoredItem[], bins: number[]) => {
  const known = rows.filter(row => row.candidate.kind === 'known')
  const labeled = known.filter(row => row.distance !== null)
  const accepted = rows.filter(row => row.accepted)
  const expectedAbstentions = rows.filter(
    row => row.item.expectation.kind === 'abstain'
  )
  const confusion = Object.fromEntries(
    CEFR_LEVELS.map(expected => [
      expected,
      Object.fromEntries(CEFR_LEVELS.map(actual => [actual, 0])),
    ])
  )
  for (const row of labeled) {
    if (
      row.item.expectation.kind === 'levels' &&
      row.item.expectation.levels.length === 1 &&
      row.candidate.kind === 'known'
    ) {
      confusion[row.item.expectation.levels[0]][row.candidate.level]++
    }
  }
  return {
    items: rows.length,
    evaluated: rows.filter(row => row.candidate.kind !== 'missing').length,
    missing: rows.filter(row => row.candidate.kind === 'missing').length,
    invalid: rows.filter(row => row.candidate.kind === 'invalid').length,
    abstentions: rows.filter(row => row.candidate.kind === 'abstain').length,
    known: known.length,
    coverage: rate(known.length, rows.length),
    exact: rate(
      labeled.filter(row => row.distance === 0).length,
      labeled.length
    ),
    within_one: rate(
      labeled.filter(row => row.distance !== null && row.distance <= 1).length,
      labeled.length
    ),
    severe_errors: rate(
      labeled.filter(row => row.distance !== null && row.distance > 1).length,
      labeled.length
    ),
    accepted_accuracy: rate(
      accepted.filter(row => row.distance === 0).length,
      accepted.length
    ),
    expected_abstention_accuracy: rate(
      expectedAbstentions.filter(row => row.candidate.kind === 'abstain')
        .length,
      expectedAbstentions.length
    ),
    confusion,
    acceptable_set_items: labeled.filter(
      row =>
        row.item.expectation.kind === 'levels' &&
        row.item.expectation.levels.length > 1
    ).length,
    confidence_reliability: bins.slice(0, -1).map((lower, index) => {
      const upper = bins[index + 1]
      const members = known.filter(
        row =>
          row.candidate.kind === 'known' &&
          row.candidate.confidence >= lower &&
          (row.candidate.confidence < upper ||
            (upper === 1 && row.candidate.confidence === 1))
      )
      const sum = members.reduce(
        (total, row) =>
          total +
          (row.candidate.kind === 'known' ? row.candidate.confidence : 0),
        0
      )
      return {
        lower,
        upper,
        count: members.length,
        mean_confidence: rate(sum, members.length),
        accuracy: rate(
          members.filter(row => row.distance === 0).length,
          members.length
        ),
      }
    }),
  }
}

export type Metrics = ReturnType<typeof summarize>
