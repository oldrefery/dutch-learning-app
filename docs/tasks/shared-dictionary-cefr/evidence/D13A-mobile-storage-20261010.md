# D13A.5 mobile SQLite storage checkpoint — October 10

Status: complete locally; D13A.5 remains in_progress. Model: GPT-6.1 Sol / High,
owner-confirmed. Checkout: feature/shared-dictionary-schema, HEAD
f97a733407a4d2b37e8f9ca030ad9574de85a794. Nine source/test files and task notes
remain local-only/uncommitted. No app database or external service was opened.

## Result

Added schema17 with owner-scoped protocol2 effective-card snapshots, applied head
pointers, exact decimal cursor strings and durable refresh versions. Following
snapshots contain references and metadata with legacy_content:null; shared analysis
stays deduplicated in the existing immutable revision cache. Legacy snapshots are
read-only downloaded projections, never new personal analysis authority. There is
no publication log or automatic mode backfill. Existing v1 tables, numeric cursors,
private originals, import/recovery payloads, learning and pending commands stay intact.

prepareHydration persists refresh debt before a future RPC. Versions remain after
completion and restart, so a late response cannot acknowledge newer work. The caller
must supply a synchronous captured-account guard to commitHydration; this checkpoint
has synthetic guard tests, not a running Auth integration. The complete bounded
bundle is parsed before transaction writes. Dependency identity, cross-batch head/CEFR
agreement, page boundary/coverage and cursor CAS are validated. Every affected cached
following reference must hydrate together. New dependencies, references, head pointers,
refresh acknowledgement and the page cursor commit in one exclusive transaction.
Errors roll back these writes and preserve prior content plus debt. Normal pulls
without a change page never advance the global delivery cursor.

Rollback delivery chooses by event sequence rather than revision number. Cached
reads use one transaction across SQL chunks and validate both wire shape and indexed
reference metadata. Account and tombstone filters apply to reads and writes. No
revision pruning occurs; captured read objects are independent of later cache updates.
Pending v1 private commands reject a v2 commit with reconciliation required; their
payloads are neither cleared nor converted. A cached follow-to-legacy mode downgrade
also requires explicit reconciliation; automatic restoration is not implemented here.

## Validation

All commands use Node24.20.0 / npm11.19.0 in the current dirty checkout; logs are in
reports/shared-dictionary-cefr/d13a5-mobile-storage-20261010/. Exact commands, source,
task-note and log hashes are in [the evidence packet](D13A-mobile-storage-20261010.json).

- Focused initializer/migration/repository tests: 3 suites / 53 tests PASS.
- Final complete mobile CI after the batch bounds change: 163 suites / 1933 tests /
  22 snapshots PASS, with configured coverage gates and no skipped tests.
- Mobile production and test-inclusive TypeScript checks PASS.
- Root lint with --max-warnings=0 PASS; source/report formatting and git diff check PASS.
- All102 prior source hashes and all37 rehearsal mirror hashes unchanged. Prior
  web92/820, Edge76 and PostgreSQL90 are carried evidence, not fresh runs here.

The new file-backed cases cover atomic final-write failure and retry after reopening,
missing/corrupt/incomplete dependencies, revision identity conflicts, late request
fences across completion/restart, decimal limits above JavaScript's safe integer,
rollback to older content with a new sequence, mixed heads/CEFR, page completeness,
A-to-B-to-A isolation and guard rollback, foreign ownership/tombstones, unchanged
private queues/originals and legacy read projections. A405-reference case reads two
SQL chunks in one snapshot and stores one revision. It is a batching regression,
not native review-start latency acceptance. Disposable databases were removed.

Initial failures are retained: fixture duplicate semantic keys and outdated migration
transaction counts (21 failed/25 passed), two fixture TypeScript shapes, then one
card_json row typing error and four lint warnings. Repairs use distinct fixture
originals, exact existing override types, schema17 expectations and smaller parsing/
transaction helpers. No suppression, timeout increase or test skip was added.
Subsequent focused50/50, final focused53/53, full1933/1933 and final types/lint pass.

Expo SQLite57.0.3's installed API was inspected. Context7 /expo/expo supplied current
[exclusive transaction guidance](https://github.com/expo/expo/blob/main/packages/expo-sqlite/skills/expo-sqlite/SKILL.md)
and [the transaction implementation](https://github.com/expo/expo/blob/main/packages/expo-sqlite/src/SQLiteDatabase.ts).
All transactional queries use the transaction executor; no RPC runs in a transaction.
Tests replace the native bridge with Node's real SQLite engine. They do not prove
Expo's separate native connection setup/foreign-key settings, lock behavior, device
performance, browser behavior, embedded/build85 compatibility or real provider quality.
Those retain D13A.7/device gates.

## Remaining work and scope

Storage is prepared; runtime dictionaryContentSync still uses protocol1. The v2
cache is not wired to word materialization, sync status or native review. No new
client flag or environment setting was enabled. Server flags remain OFF, memberships/
policies unseeded, shared_analysis unavailable and CEFR OFF. D13 observation remains
open; D14pending. AUTH27/28/29 remain consumed. No real card conversion, paid/provider
call, hosted migration/grant/link/publication, Git commit/push/PR/merge, release/EAS/
device operation or automation occurred. Unrelated services/QA/backups/.playwright-cli
and sealed OTA artifacts are preserved. All runners exited; no external operation pending.

Next **D13A.5 — recommended GPT-6.1 Sol / High**: wire explicit default-OFF following
capability/read v2 into mobile sync, bounded owner/session-fenced fetching and atomic
page commits through the new storage; expand refreshes to every cached reference for
an affected entry, preserve v1 push/receipts and reconciliation debt, materialize typed
content/revision metadata and integrate sync status. Verify offline/account return and
immutable native review sessions, including native connection behavior when device
acceptance is authorized. Handle approved mode restoration explicitly rather than
weakening the cache downgrade guard. Fetch current Supabase/SQLite API docs before
new calls. Shared-only Analyze again/receipt recovery and remaining web recovery/
following performance are later D13A.5 checkpoints. High is recommended for the
Auth/queue/cursor/session invariants; D13A.5 is not complete.
