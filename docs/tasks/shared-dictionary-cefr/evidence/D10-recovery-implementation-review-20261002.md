# D10 recovery implementation review — 2026-10-02

Status: **changes required; checkpoint 6 acceptance blocked by two reproduced defects**.
Reviewed application source `b7f207c` / documentation `16da8dc`, existing branch
`feature/shared-dictionary-schema`. User confirmed Astra / High. AUTH-17/AUTH-18
allow this local review and commits. No model picker operation is claimed.

## R1 — P1: ordinary imported moves bypass expected-placement protection

The supported mobile path `wordRepository.moveWordToCollection` records an explicit
local placement revision. `prepareImportMetadata` reads current remote placement,
but explicit debt is passed to `SyncManager.executeDictionaryMetadata`, whose UPDATE
filters only owner, personal IDs and active rows. It has no expected placement or
recovery-version guard. Local revision checks before acknowledging cannot undo a
remote overwrite.

Reproduction: A queues Original → Target and reads Original. B commits versioned
recovery Original → Next. A's delayed ordinary UPDATE writes Target over Next and
acknowledges its own local revision. The server recovery version stays 1; replaying
B's cached receipt is correctly a no-op, so it does not repair the overwrite.

Two complementary counterexamples establish reachability and server behavior:

- `apps/mobile/src/services/__tests__/dictionaryImportReviewBaseline.sqlite.test.ts`
  calls the actual metadata delivery method and real file-backed repositories.
  The mocked network returns the initial placement and simulates B's newer placement
  before A writes. A sends no collection equality predicate, overwrites Next with
  Target and records acknowledged revision 1. Network concurrency itself is not
  proven by this mock; the SQL test below supplies that evidence.
- `scripts/postgres-tests/dictionary-import-placement-review-baseline.test.mjs`
  pins all migrations through `20261002120000_add_dictionary_import_recovery.sql`.
  Real PostgreSQL sessions hold B's recovery transaction while A's exact current
  UPDATE waits on its row lock. After B commits, A overwrites the placement. Version
  1 and historical receipt replay are also checked. The cluster is temporary and
  isolated, using only synthetic data and a private Unix socket.

This violates the accepted contract's expected-placement guard for ordinary moves.
It is a current supported-client defect, separate from the acknowledged legacy
client coexistence/adoption release gate. No claim is made that one SyncManager
instance can deliver two passes concurrently.

Required repair: remove unguarded writes for tracked imported placement debt. Bind
ordinary moves to a durable expected-placement proposal and protect delivery
atomically; reusing the immutable versioned recovery protocol is one option.
Do not reread/rebase automatically on conflict or lost reply. Preserve already
retained local revision debt, exact root/personal ID/SRS/content/learning queues,
read-only target rules and the conservative marker-only v15 gate. Cover both write
orderings, lost replies/replay, restart, newer local proposal and owner ABA. Arbitrary
legacy direct writes remain subject to their explicit adoption/write-guard gate.

## R2 — P2: cancellation acknowledgement hides pending word deletion

`dictionaryImportCancellationRepository.accept` correctly retires cancellation and
original outboxes while leaving normal word tombstone delivery pending. However,
`dictionaryImportDeliveryRepository.getDebtWordIds` excludes deleted cards once
`cancelled = 1`, and `syncStatusService.getSnapshot` does not count normal tombstones.

The second SQLite counterexample imports and acknowledges a card, queues deletion,
then accepts cancellation. Pending words change from 1 to 0 while
`wordRepository.getDeletedWords` still returns the unsent tombstone. With a previous
sync timestamp, Settings' `getSyncSummaryLabel` renders “Up to date” whenever the
coordinator is idle. The server cancellation contract intentionally does not delete
the remote word; interruption/offline or a failed normal tombstone write leaves
actual delivery incomplete.

Required repair: pending status must cover the entire cancellation → normal deletion
handoff, deduplicating the same logical card across queues. Keep unsent tombstones
visible after cancellation ACK and restart; clear them only after normal deletion
is acknowledged. Include failed delivery and the final acknowledged transition in
regression coverage. Inspect the equivalent collection tombstone count while fixing
this shared status logic; do not expand into unrelated UI redesign.

## Review scope and validation

Reviewed root binding/private registry, migration/backfill, recovery/read/cancel
locking and replay, SQLite exact outbox checks, owner/revision guards, sync ordering,
placement hydration, UI recovery reachability and applicable web boundary. The two
findings above prevent acceptance; this is not a claim of exhaustive defect absence.
Historical v14 upgrade and marker-only v15 handling still need assigned-device
acceptance, along with native OS/in-flight lifecycle and both-client import/export.
Web has immediate content-copy imports, not the mobile durable recovery outbox.

On 2026-10-02:

- Focused mobile review suite: **2/2 counterexamples reproduced**.
- Isolated PostgreSQL reverse-order race: **1/1 counterexample reproduced**.
- Mobile test-inclusive TypeScript and strict scoped ESLint pass.
- Application/server code is unchanged. Prior 213/213 server suite and prior native
  evidence were not rerun or relabelled as new acceptance.
- These tests deliberately assert unsafe baseline behavior. Passing does **not**
  mean the feature is correct. Convert the mobile counterexamples to protective
  regressions during repair; keep the SQL baseline pinned and add safe-path tests.
- Initial SQL startup was denied by sandbox shared-memory restrictions. The same
  scoped synthetic harness completed with authorized escalation and automatic
  cleanup. Initial test-only inferred recursive mock typing failed TypeScript;
  fixed before the final passing check. No test or hook bypass.

Exact assigned resources reverified off at 11:26 UTC: iOS Shutdown, task AVD
process absent, all four task containers exited. No assigned devices or retained
QA backend were started/reset. No production,
cutover, remote push/PR/merge, deployment, publication, paid call or automation
change. Private `.playwright-cli/` and ignored retained QA artifacts remain untouched.

Review checkpoint committed locally as `4f7a6a6`. Normal hooks passed **156 mobile
suites / 1787 tests / 22 snapshots** and **75 web suites / 648 tests**, with one
existing skipped web suite/test. All 113 source fingerprints match. No pending
operation remains after hooks; `.playwright-cli/` stays private and untracked.

Next: **GPT-6.1 Sol / High** implements R1/R2, then **Astra / High** reviews repairs
before assigned-device/both-client acceptance. Current-thread model switching is
unavailable; require user confirmation of the manual switch. D10.3–D10.5 stay open;
D11 is not started.
