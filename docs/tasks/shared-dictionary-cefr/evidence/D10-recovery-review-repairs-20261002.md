# D10 recovery review repairs — 2026-10-02

Status: **R1/R2 implemented and focused checks pass; Astra re-review and integrated
acceptance remain open**. User-confirmed GPT-6.1 Sol / High, existing branch
`feature/shared-dictionary-schema`, starting HEAD `fa286e4` / application `b7f207c`.
AUTH-17/AUTH-18, local work and commits only. Current-thread picker is unavailable.

## R1 — durable guarded ordinary imported placement

`recordExplicitImportMove` now queues the existing strict recovery request inside
`wordRepository.moveWordToCollection`'s exclusive transaction. A settled card's exact
original intent, retained server version, current local placement, chosen target,
fresh operation UUID and next local revision are durable before network delivery.
The existing recovery coordinator sends this immutable request; the existing server
RPC atomically validates version/placement and stores the idempotent receipt.

A different client moving first produces a nonmutating conflict, requiring explicit
Saved imports recovery. A lost reply replays the exact operation and base after
restart. Historical success cannot move the card again. The local transaction
retains owner checks and owned active target validation. Private content, personal
ID and SRS/history remain unchanged; content/learning queues survive delivery.

Tracked placement debt cannot enter generic metadata UPDATE. Settled cards hydrate
current remote placement as before; unbound retained debt is gated visibly in Saved
imports without inferring a base, automatic rebase or acknowledgement. Pending,
unknown-origin/version and cancelled delivery states cannot queue an ordinary move.
Marker-only v15 recovery remains conservative. The now-unused unversioned placement
acknowledgement method/caller was removed. Non-imported and flag-off move behavior
retain their existing paths.

No schema, domain parser or server RPC change was necessary. Raw legacy direct
UPDATE remains possible in the explicitly recorded legacy coexistence/adoption gate;
this repair changes the supported new client delivery path. It does not claim a
server-wide guard against arbitrary older clients.

## R2 — pending status across cancellation and normal deletion

`syncStatusService` includes `getDeletedWords` and `getDeletedCollections` alongside
active pending rows. Logical IDs are deduplicated across ordinary metadata,
content/import/recovery/debt and deletion queues. A cancellation receipt retires its
outbox but cannot hide a still-unsent word tombstone. Failed delivery and restart
retain pending status; normal tombstone acknowledgement clears it. Collection
removal receives the equivalent status treatment. The counts work with the
dictionary runtime feature disabled as well.

No UI text/theme change or new background worker is introduced. Settings already
uses totalPending, so incomplete deletion cannot produce its zero-pending status
once the snapshot observes the retained tombstone.

## Verification and limits

Application source changed only in mobile repositories/coordinator/status. Tests
use actual file-backed SQLite and an isolated synthetic PostgreSQL cluster. No
retained QA device/backend start, reset or reseed occurred.

- Mobile focused integration: **8 suites / 139 tests passed** using `CI=true npm run
mobile:test -- --runInBand --no-watch --no-coverage --watchman=false --runTestsByPath`
  with review regressions, import metadata/recovery/recovery-sync, sync status,
  SQLite recovery/restart and SyncManager suites.
- Final review/status check after adding dormant-feature deletion coverage:
  **2 suites / 19 tests passed** with the same command, review regression + status.
- `WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin node --test
--test-concurrency=1 --test-timeout=120000
scripts/postgres-tests/dictionary-import-recovery.test.mjs`: **17/17 passed**.
  New real locked overlaps cover either winner, stale loser rejection, later
  explicit movement and historical receipt replay. Other recovery/cancellation,
  source retirement, read-only and rollback cases remain in this focused file.
- Mobile test-inclusive `npm run mobile:typecheck:test` and strict scoped ESLint
  pass. Prettier/diff checks pass. Initial async RPC mock typing and duplicated
  test literals were corrected before final checks; no lint suppression.
- The original two mobile counterexamples were converted and renamed to
  `dictionaryImportReviewRegression.sqlite.test.ts` (10 safety tests). Historical
  review evidence is in commit `4f7a6a6`; the pinned SQL unsafe baseline remains
  unchanged. A passing regression now requires protected behavior.
- Existing server migrations/target schema are unchanged. The historical 213/213
  full SQL suite is not claimed as a new run. This focused file adds one test.

Native v14/marker-only v15 upgrade, OS/in-flight lifecycle, assigned-device and
both-client import/export/reimport acceptance remain unverified. Astra / High must
review these repairs before acceptance. D10.3–D10.5 stay unchecked; D11 not started.
Default runtime flags stay off outside QA. No production/cutover, hosted migration,
push/PR/merge, deployment, publication, paid operation or automation change.
Private `.playwright-cli/` and retained ignored QA artifacts remain untouched.

Next: user-confirmed **GPT-6 Astra / High** re-review of R1/R2 and their regressions,
then task-only integrated acceptance if the review passes. Never infer an automatic
model switch from this recommendation.
