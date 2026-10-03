# D11 local diagnostic collector and report

2026-10-03, starting `268dcae`, existing `feature/shared-dictionary-schema`.
Recommended GPT-6.1 Sol / High announced; current model-picker attribution cannot be
verified. AUTH-20 local fake-provider implementation and AUTH-18 necessary local
commits. No subagent, provider account/key, network call, device/backend or hosted
operation.

The new collector reads the exact 24-item worklist, provisional model reference,
method profile, prompt and proposed allowance. It validates canonical input hashes,
provisional-reference binding, 12/12 split, eleven pooled slices, prompt/profile
hashes and cost arithmetic. It freezes the prepared bundle; the reference is not
included in requests. Only a fake transport is available. The standalone fake CLI
uses deterministic mechanics answers; it does not evaluate model quality.

A private SQLite journal records each full cost/token reservation transactionally
before fake generation. Attempts and captures are separate insert-only rows, with
unique response identities. A crash after reservation retains its full charge; at
most two attempts per meaning and 48 total can be reserved. Active-run leasing
prevents concurrent retries; resumes require the same frozen bundle and UTC day.
The token preflight, generated body and transport envelope have explicit bounds.
Timeout, 429/5xx, transport errors, incomplete/malformed answers, usage above the
reservation, duplicate response IDs and mixed resolved model versions stop or
retry conservatively. The CLI writes a private report only to a new path.

The report is `dictionary-cefr-diagnostic-report-v1`. It shows fake provenance,
reserved and observed simulated usage, latency, per-split/slice counts, confidence
bins, coverage, agreement with provisional bands and separate ambiguity probes.
It has no pass/fail quality gate, no reviewed label claim and no qualification.
The existing reviewed-fixture report, worker qualifier and default-off runtime are
unchanged. The 19 provisional bands and five unknowns remain model-origin evidence.

## Local verification

- `node --test scripts/cefr-calibration/diagnostic.test.ts`: **12/12 PASS**.
  Covers no-overwrite report, restart after an uncaptured reservation, retry/429,
  timeout, budget retention, over-bound usage/input, concurrent collector exclusion,
  digest/day mismatch, duplicate response ID, mixed model version, frozen bundle
  and no reference in the request. Test log in the ignored private run directory.
- Scoped TypeScript check, strict ESLint and Prettier: PASS.
- Fake CLI: 24 meanings, 24 reservations, 22 known and two abstentions, 19
  model-reference comparisons. Reserved fake maximum 956,736 micro-USD; observed
  simulated usage 9,720 micro-USD. These numbers are mechanical estimates, not
  actual charges or CEFR accuracy. Private report/log retained under
  `reports/shared-dictionary-cefr/d11-diagnostic-collector-20261003/`.
- Previous 192 source hashes retained; [200-path source inventory](D11-diagnostic-collector-source-sha256.json)
  remained exact after ordinary implementation commit `59af814`. Normal hooks
  passed: mobile 156 suites /1796 tests /22 snapshots; web 86 suites /780 tests,
  one existing skip. No push.

## Remaining D11 boundary

This checkpoint completes the local fake diagnostic collector and separate report.
A real provider adapter and paid execution are not present. Before a live sample,
implement exact provider token counting, durable control-request accounting,
authentication, response metadata verification, current price/model binding and
source transmission permission; test the concrete adapter, then present the exact
account/inputs/ceiling for approval. Independent CEFR quality remains unproven; the
assistant reference cannot qualify the operational worker. Do not ask for a teacher
to continue local work. D11 remains in_progress; D12 has not started.
