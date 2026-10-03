import { createHash } from 'node:crypto'
import { closeSync, fsyncSync, openSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import {
  canonicalizeJson,
  CEFR_LEVELS,
  type CefrLevel,
} from '../../packages/domain/src/shared-dictionary.ts'
import { rate } from '../../supabase/functions/_shared/cefr-calibration/metrics.ts'
import { REQUIRED_SLICES } from '../../supabase/functions/_shared/cefr-calibration/fixture.ts'
import type { DiagnosticBundle, Meaning } from './diagnostic-bundle.ts'
import {
  countAttempts,
  lastCapture,
  type SqliteDatabase,
} from './diagnostic-store.ts'
import type { Captured } from './diagnostic-types.ts'
const sha = (value: string): string =>
  createHash('sha256').update(value).digest('hex')

const stats = (
  rows: { meaning: Meaning; attempts: number; capture: Captured | null }[]
) => {
  const known = rows.filter(row => row.capture?.candidate.kind === 'known')
  const scored = known.filter(row => row.meaning.reference !== null)
  const distance = (row: (typeof known)[number]): number => {
    const level = (
      row.capture?.candidate as { kind: 'known'; level: CefrLevel }
    ).level
    return Math.min(
      ...(row.meaning.reference ?? []).map(ref =>
        Math.abs(CEFR_LEVELS.indexOf(ref) - CEFR_LEVELS.indexOf(level))
      )
    )
  }
  const probes = rows.filter(row => row.meaning.ambiguityProbe)
  return {
    items: rows.length,
    attempted: rows.filter(row => row.attempts > 0).length,
    known: known.length,
    abstained: rows.filter(row => row.capture?.candidate.kind === 'abstain')
      .length,
    invalid: rows.filter(row => row.capture?.candidate.kind === 'invalid')
      .length,
    missing: rows.filter(
      row => row.capture === null || row.capture.candidate.kind === 'missing'
    ).length,
    failed: rows.filter(row => row.capture?.outcome === 'failed').length,
    reference_unknown: rows.filter(row => row.meaning.reference === null)
      .length,
    agreement_exact: rate(
      scored.filter(row => distance(row) === 0).length,
      scored.length
    ),
    agreement_within_one: rate(
      scored.filter(row => distance(row) <= 1).length,
      scored.length
    ),
    ambiguity_probe_abstention: rate(
      probes.filter(row => row.capture?.candidate.kind === 'abstain').length,
      probes.length
    ),
    coverage: rate(known.length, rows.length),
    confidence_bins: [0, 0.5, 0.8, 1.01].slice(0, -1).map((lower, index) => {
      const upper = [0, 0.5, 0.8, 1.01][index + 1]
      const members = known.filter(row => {
        const confidence = (
          row.capture?.candidate as { kind: 'known'; confidence: number }
        ).confidence
        return confidence >= lower && confidence < upper
      })
      return { lower, upper: Math.min(1, upper), count: members.length }
    }),
  }
}
export const buildReport = (db: SqliteDatabase, bundle: DiagnosticBundle) => {
  const meta = new Map(
    (
      db.prepare('SELECT key,value FROM meta').all() as {
        key: string
        value: string
      }[]
    ).map(x => [x.key, x.value])
  )
  const rows = bundle.meanings.map(meaning => ({
    meaning,
    attempts: countAttempts(db, meaning.id),
    capture: lastCapture(db, meaning.id),
  }))
  const totals = db
    .prepare(
      'SELECT COUNT(*) AS requests, COALESCE(SUM(reserved_microusd),0) AS cost, COALESCE(SUM(reserved_tokens),0) AS tokens FROM attempts'
    )
    .get() as { requests: number; cost: number; tokens: number }
  const captures = db.prepare('SELECT body FROM captures').all() as {
    body: string
  }[]
  const observed = captures.map(x => JSON.parse(x.body) as Captured)
  const controls = db
    .prepare(
      'SELECT COUNT(*) AS requests, SUM(CASE WHEN receipt IS NOT NULL THEN 1 ELSE 0 END) AS receipts, COALESCE(SUM(reserved_microusd),0) AS cost, COALESCE(SUM(reserved_tokens),0) AS tokens FROM controls'
    )
    .get() as {
    requests: number
    receipts: number | null
    cost: number
    tokens: number
  }
  const body = {
    namespace: 'dictionary-cefr-diagnostic-report-v1',
    interpretation: 'unqualified_model_reference_agreement',
    qualified: false,
    calibration_eligible: false,
    rejection_reason:
      meta.get('rejection_reason') ??
      observed.find(row => row.outcome === 'failed')?.reason ??
      null,
    run_id: meta.get('run_id'),
    utc_day: meta.get('utc_day'),
    binding_sha256: bundle.bindingSha256,
    worklist_sha256: bundle.worklistSha256,
    reference_sha256: bundle.referenceSha256,
    profile_sha256: bundle.profileSha256,
    prompt_sha256: bundle.promptSha256,
    provenance: meta.get('transport_kind') ?? 'fake',
    execution_sha256: meta.get('execution_sha256') ?? null,
    implementation_sha256: meta.get('implementation_sha256') ?? null,
    reserved: {
      requests: totals.requests,
      tokens: totals.tokens,
      microusd: totals.cost,
    },
    controls: {
      requests: controls.requests,
      receipts: controls.receipts ?? 0,
      unknown_outcomes: controls.requests - (controls.receipts ?? 0),
      reserved_microusd: controls.cost,
      reserved_tokens: controls.tokens,
      billing_ref: meta.get('control_billing_ref') ?? null,
      observed_microusd:
        meta.has('execution_sha256') && controls.cost === 0 ? 0 : null,
    },
    reserved_all: {
      requests: totals.requests + controls.requests,
      tokens: totals.tokens + controls.tokens,
      microusd: totals.cost + controls.cost,
    },
    observed: {
      verified_captures: observed.filter(x => x.observed_microusd !== null)
        .length,
      microusd: observed.reduce(
        (sum, x) => sum + (x.observed_microusd ?? 0),
        0
      ),
      unknown_usage:
        totals.requests -
        observed.filter(x => x.observed_microusd !== null).length,
      timeout: observed.filter(x => x.reason === 'timeout').length,
      retry: observed.filter(x => x.outcome === 'retry').length,
      duration_ms_total: observed.reduce((sum, x) => sum + x.elapsed_ms, 0),
      duration_ms_max: Math.max(0, ...observed.map(x => x.elapsed_ms)),
      resolved_model_versions: [
        ...new Set(observed.map(x => x.model_version).filter(x => x !== null)),
      ].sort(),
    },
    total: stats(rows),
    splits: Object.fromEntries(
      (['calibration', 'held_out'] as const).map(split => {
        const selected = rows.filter(row => row.meaning.split === split)
        return [
          split,
          {
            ...stats(selected),
            slices: Object.fromEntries(
              REQUIRED_SLICES.map(slice => [
                slice,
                stats(
                  selected.filter(row => row.meaning.slices.includes(slice))
                ),
              ])
            ),
          },
        ]
      })
    ) as Record<
      'calibration' | 'held_out',
      ReturnType<typeof stats> & {
        slices: Record<string, ReturnType<typeof stats>>
      }
    >,
    items: rows.map(row => ({
      id: row.meaning.id,
      input_sha256: row.meaning.inputHash,
      split: row.meaning.split,
      attempts: row.attempts,
      candidate_kind: row.capture?.candidate.kind ?? 'missing',
      candidate_level:
        row.capture?.candidate.kind === 'known'
          ? row.capture.candidate.level
          : null,
      reference_band: row.meaning.reference,
      ambiguity_probe: row.meaning.ambiguityProbe,
    })),
  }
  return { ...body, sha256: sha(canonicalizeJson(body)) }
}
export const writeNewDiagnosticReport = (
  runDir: string,
  report: ReturnType<typeof buildReport>
): string => {
  const path = join(runDir, 'diagnostic-report.json')
  const fd = openSync(path, 'wx', 0o600)
  try {
    writeSync(fd, `${JSON.stringify(report, null, 2)}\n`)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  return path
}
