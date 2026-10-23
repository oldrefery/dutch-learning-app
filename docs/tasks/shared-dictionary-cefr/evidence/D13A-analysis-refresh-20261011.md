# D13A.5 item6 — shared analysis publication refresh

October11,2026. Complete locally; D13A.5 remains in_progress. Branch
feature/shared-dictionary-schema, HEADf97a733; local/uncommitted. Next model
recommendation: GPT-6.1 Sol / High; no picker switch claimed.

The exact saved published/no-change receipt now has a content-only reload action.
It performs authenticated common-content reads independently of shared-analysis
permission/opt-in, with following/read gates still required. It never starts a new
intent, polls receipt status, calls an analysis endpoint or rewrites the receipt.
Ordinary unknown-status recovery and a distinct deliberate next attempt remain
separate paths. Mount only reads local operation metadata/eligibility.

Native complete sibling hydration binds the exact operation inside its exclusive
SQLite commit and updates dependency revisions, heads, cards and refresh debt
atomically. Failed/corrupt/stale reads, journal replacement, unavailable following,
private queues and captured owner/view lifetimes preserve cache and retryable debt.
A disk reopen can retry reads. Current learning/collection edits remain independent.
Actual displayed entry/head/revision determines whether content is already loaded;
a later rollback head is valid and an older cache cannot replace it.

Web loads a strict target snapshot and validates a fresh owner-only server read
before revalidating /app as a layout, covering collection/detail/review navigation.
It applies only while the captured view generation remains live. New personal props
are retained if an old publication belongs to another mode/reference. Cache refresh
failure retains the receipt and offers a content-load retry without analysis.
Server revalidation is a read-only data action plus cache invalidation; it does not
change dictionary data or publish any site/release.

## Verification

- Native full:196 suites/2670 tests/22 snapshots, unchanged configured coverage,
  maxWorkers1; native focused7/179, including real file-backed Node SQLite/reopen.
- Web full:118 suites/1241 tests; focused4/56; existing opt-in Node benchmark enabled.
- Edge:108 tests. Domain/native production/native test/web types, scoped zero-warning
  domain/native/web lint, formatting and diff pass.
- PG547/worker35 are historical, not rerun. New TypeScript-AST runtime dependency
  closures91/23 and additional SQL/migration dependencies match their prior bytes.
  Client dependencies reachable only through erased type imports do not invalidate
  these historical runtime results. The previous broad manifests remain immutable.
- Fifteen existing source/test extensions; evidence union357, native boundary196,
  web136/Edge76. Prior465 direct hash references verified at entry; historical37
  mirrors/47 artifacts preserved. See [machine report](D13A-analysis-refresh-20261011.json)
  for exact source, logs, integrity and limits.

Initial diagnostic runs repaired test fixtures/selectors, mounted-guard arguments,
wrong focused paths and lint constants/dependencies. A web benchmark exceeded the
existing5000ms timeout while native ran concurrently; the final full web run passes
without contention at the unchanged timeout. A native full run before the final
button-mode gate is retained only as diagnostic evidence; final full validates frozen
bytes. No failed or intermediate run is counted as final acceptance. The previous
checkpoint's two-worker SQLite SIGSEGV remains historical and unproven; this full
native run uses one worker. Synthetic SDK/Auth/UI cases and a Node CPU benchmark do
not establish device, browser latency or complete offline/performance acceptance.

## Progress and next scope

Fixed original D13A.5 checklist: **7/8 complete, only item8 open**. Item7 remains4/4
areas and area4 remains2/2 checkpoints. Next: original item8 web offline/account-return
and representative review-start performance/parity, GPT-6.1 Sol / High. Inspect the
existing recovery/browser performance harness; qualify offline debt/retry, owner
return/isolation and collection/detail/review freshness. D13A.6 corpus mapping/apply/
rollback remains separate. Ten broader numbered milestones remain while D13A.5 is
open; these are not estimates of turns.

Flags unchanged/OFF, shared_analysis FALSE/CEFR OFF; AUTH27-29 consumed. No provider,
paid, hosted migration, Git publication, EAS/device/release or automation operation.
All runners exited; no pending operations or new permission assumed.
