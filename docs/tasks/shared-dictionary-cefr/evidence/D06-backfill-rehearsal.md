# D06 local backfill rehearsal evidence

Date: 2026-09-21. Branch: `feature/shared-dictionary-schema`; HEAD:
`c5dfb14d49b9`. Persistence: local and uncommitted. AUTH-12 covers this work.
The user reported switching models; this continuation used the GPT-6 family.
Exact picker variant/effort was not independently observable. Implementation,
test inspection and the review below occurred in the same session; no separate
review agent or independent model review is claimed.

## Scope and artifacts

- `scripts/shared-dictionary/rehearsal.sql`: administrator-only seed, dry-run,
  bounded apply, append-only ledger and aggregate/delta report functions.
- `scripts/shared-dictionary/README.md`: reproducible local rehearsal and operator
  instructions, source/CEFR boundaries, resume, verification and rollback.
- `scripts/postgres-tests/dictionary-backfill.test.mjs`: sixteen synthetic
  scenarios, including independent comparisons of original personal/learning rows.

The SQL is deliberately outside automatic migrations and exposes no public RPC.
It was installed only in disposable Unix-socket PostgreSQL clusters made by the
existing test harness. No hosted SQL, source publication, paid call, personal
export, mobile/device operation, deployment, commit or push occurred. Production
remains on its current path. Only synthetic fixture clusters enabled capabilities.
No generated application contract changed in D06.

## Checkpoints and reviewed dry-run report

The six-card synthetic mapping has exactly one item in each disposition:

| Disposition    | Count | Reviewed behavior                                               |
| -------------- | ----- | --------------------------------------------------------------- |
| safe-match     | 1     | One exact reviewed linguistic revision; eligible for linking.   |
| possible-match | 1     | Same spelling but different meaning content; no automatic link. |
| private-only   | 1     | Explicitly private; untouched.                                  |
| excluded       | 1     | Explicit exclusion; untouched.                                  |
| stale-source   | 1     | Supplied fingerprint disagrees; fresh evidence required.        |
| missing-source | 1     | No reviewed source; retained unchanged.                         |

Coverage totals six unique original personal IDs; before/after personal and
learning snapshots are equal. Separate cases verify malformed legacy content,
tombstones, identical-content ambiguity and two owners retaining separate IDs
while referencing the same reviewed meaning. This is a synthetic report, not a
production eligibility census for P1/P2.

- **D06.1:** complete scoped snapshot and six-way mapping; independently checked
  counts, no out-of-scope supplied IDs, immutable request/plan digest, explicit
  new-card and changed/missing-card delta counts. `remaining = 0` is insufficient
  for release if delta counts are nonzero.
- **D06.2:** official seeds require first-party/licensed approved provenance,
  reviewed manifest binding, actual canonical content/input fingerprints and an
  explicit stable meaning resolution. Exact retries reuse one reference. Optional
  historical CEFR needs matching meaning, input, source and assessment metadata;
  pack-level labels, stale hashes and another meaning fail atomically. Estimates
  remain estimates; missing evidence inserts no assessment. No real historical
  artifact was imported or presumed approved.
- **D06.3:** exact stored legacy content/metadata, personal IDs, collections,
  tombstones and all learning state remain unchanged by apply. Tests compare words,
  collections, user progress, review events, resets, cutovers, review checkpoints,
  heads and corrections using queries separate from the backfill fingerprint.
  Only reference columns, the delivery timestamp and new content-state row change.
  Media-only differences remain private overrides and retain applicable CEFR.
- **D06.4:** 1–100 items per transaction, word/content compare-and-set, bounded
  locks, skip/retry for busy cards, durable append-only receipts, overlapping-run
  rejection, idempotent resume. Review arrivals do not invalidate unchanged
  content and their SRS/history survive. Changed text, membership and tombstones
  are rejected with a durable terminal result and require a new reviewed plan.
- **D06.5:** transaction rollback leaves neither a link nor a receipt. Separate
  connections resume from committed receipts. Read-path rollback returns to v1
  and preserves a review written after linking. Full connection/process crash and
  native pending-queue preservation are not claimed by these SQL tests; native
  queue/upgrade coverage remains in D07–D12 and D01 evidence gates.

## Review and regression fix

Review checked authority boundaries, immutable reviewed input binding, source
fingerprint coverage, row-lock ordering, learning-write preservation, resume
semantics and read rollback. Official PostgreSQL 15 documentation was consulted
through Context7 for row locks and exception rollback semantics.

A fault-injection regression exposed an inaccurate `applied` count when receipt
insertion raises `lock_not_available`: the subtransaction rolled back the link
but PL/pgSQL retained the incremented variable. The test failed before the fix
(`applied: 1` instead of `0`). Counters now advance only after the receipt is
written. The final sixteen-scenario run passes, including no surviving link/state
after the injected error and successful retry afterward.

This closes the local tooling/rehearsal gate. It does not replace a release review
of exact real input manifests, hosted execution procedure and mobile compatibility.

## Verification

All commands used Node 24 and local PostgreSQL 15; no application environment or
hosted connection variables were loaded.

- `npm run test:db`: **172/172 passed**, including the first fifteen D06 cases.
  This full run preceded the final counter fix/fault-injection case.
- `node --test --test-concurrency=1 scripts/postgres-tests/dictionary-backfill.test.mjs`:
  **16/16 passed on the final SQL/test files**, after reproducing and fixing the
  receipt-counter error. The final change is isolated to this local SQL utility;
  existing migration/application files were not changed.
- `npm run lint:ci`, explicit lint for the new `.mjs` test, repository formatting,
  explicit new-file formatting and `git diff --check`: passed.
- Test harnesses exited successfully and ran their `after` cluster cleanup.
  No task-owned operation remains running or uncertain.

## SHA-256

- SQL tooling: `802333e495ec3a2965393e4bcea1ec4834d01380fb21ce4645aeaad8dd8e16bd`
- Tests: `273bde39e79637e3db183c949c70fcc621224e815679dd969e55d7b2bc4a2db6`
- Operator README: `7861aa363cbc3f92df7f27bb86a6e92e4dbee0cb80d0bcf47117772fbae7718e`

## Next stage

D07 mobile SQLite storage, recommended GPT-5.6 Sol / High. Resume through the
saved handoff without repeating D06. D01 Android and complete learning-queue
evidence remain mandatory before release. D13 requires exact reviewed artifacts,
backups, final delta reconciliation, verified client rollout and explicit cutover
approval. No real-account mapping has been applied.
