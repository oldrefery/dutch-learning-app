# D10.3 — mobile recovery sync checkpoint

Status: accepted-contract checkpoint 4 implemented locally in `abc0b86`, following
server/domain `1828f57` and SQLite `1748066`. A final foreground-resume hook test
is preserved in the following checkpoint. User-confirmed GPT-6.1 Sol / High,
AUTH-17/AUTH-18; existing branch, local only. Runtime dictionary gates remain off
outside task QA. No hosted migration, push, deployment or paid operation.

## Implemented behavior

- The shared mobile coordinator enumerates retained explicit import tombstones,
  delivers cancellation before collection deletion, and recovery before original
  imports and dependent metadata/content/learning. It replays each persisted exact
  nonce/payload after lost replies. Recovery/cancellation errors and nonmutating
  typed conflicts retain local debt; no automatic rebase or identity adoption.
- Explicit word, bulk word and collection deletion persist complete cancellation
  barriers with their tombstones in exclusive transactions. Whole-collection deletion
  includes the collection status in the same transaction. Deletion sync rechecks
  unsettled barriers immediately before ordinary remote deletes. Remote cleanup
  preserves tracked imports; remote synced tombstones never fabricate cancellation.
- Proven delivered placement is independent of generic pending metadata/learning.
  A batched owned personal-row read supplies current placement and timestamps;
  already delivered imports perform no collection UPDATE. Hydration changes only
  placement after checking captured revision, acknowledgement, outbox and active
  owner. Missing imported IDs are unavailable, never bootstrapped.
- Explicit ordinary moves on settled imports atomically increment placement debt.
  Pending/unverified imports require the recovery path. Delivery acknowledges only
  the exact current revision/target; later local moves remain pending even if generic
  metadata status becomes synced. Delivered cards can hydrate NULL/server placement
  without inserting a collection. Unknown v15 provenance/delivery remains unresolved.
- Authentication is checked before/after network work. A synchronous auth-event
  watcher remains invalidated after sign-out even if the same owner returns; guards
  before/after SQLite transactions roll back account changes. Source acknowledgement
  and error writes now accept the same owner guard. Old-owner results do not refresh
  or publish into the active application store.
- Pending status deduplicates recovery/cancellation IDs and placement debt alongside
  existing imports/content/refresh queues. A generic metadata acknowledgement cannot
  turn retained import debt into an “Up to date” result.

## Verification

Focused regression run: **10 suites / 166 tests passed** at `abc0b86`. Three new
file-backed suites contain **19 tests** for lost recovery/cancellation replies,
proposal replacement and cancellation during an in-flight response, owner changes
and sign-out, metadata echo, later explicit moves, conservative provenance, missing
IDs, rollback, atomic bulk deletion and remote-cleanup/cancellation distinction.
Full SyncManager tests prove no UPDATE to the historical target while learning is
pending, and cancellation failure stops before collection deletion/dependent work.
Status and old-owner store publication are covered too.

Normal application commit hooks: **154 mobile suites / 1763 tests / 22 snapshots**;
**75 web suites / 642 tests**, one existing skipped suite/test. Test-inclusive
mobile TypeScript, strict scoped ESLint (`--max-warnings 0`), format/diff checks pass.
No suppressions or hook bypass; advisory file-length notices remain nonblocking.
The final hook test passed **7/7** in its suite: automatic work pauses on background
and foreground resume invokes the same coordinator. That added test and docs are
saved together by the following checkpoint's ordinary hooks.

No OS background worker exists in this app: interval/network/mount sync starts only
while active; foreground resume uses `performSync`. An already running pass retains
its persisted requests. This checkpoint does not claim native OS-background execution
or new scheduler behavior. Device acceptance is checkpoint 6.

Initial failures were fixture/static issues: missing mocked `getUser`, RPC builder
versus Promise test types, missing subscription/word fields, old prepareAsync deletion
expectations, and a synthetic delivered card with no placement acknowledgement.
The fixtures now express the tested delivered state; actual rollback and service
behavior are tested on file-backed SQLite. Cognitive complexity was reduced by
splitting receipt acceptance/delivery and metadata acknowledgement helpers. A failed
full mobile run had 153 suites passing and one obsolete deletion expectation; final
normal commit hooks passed every suite.

Context7 Supabase JS documentation and the installed auth client source were
checked for synchronous `onAuthStateChange` subscription/unsubscribe behavior.
No new API dependency or SDK upgrade. Tests mock only network/native boundaries;
SQLite fixtures use private files and clean up their own directories. SQL/schema
source is unchanged from the preceding **213/213** server run; it was not repeated.

## Remaining checkpoints and QA

Checkpoint 5 on GPT-6.1 Sol / High: existing-target recovery UI, explicit state-read
and fresh-proposal retry, visible retained/semantic debt, both themes/account changes,
safe pre-upgrade behavior and applicable web integration. Current service APIs can
send prepared proposals; the recovery UI is not connected. Original conflict retry
still supports only pre-recovery roots; UI must route claimed roots through recovery.
Checkpoint 6: Astra / High implementation review, assigned native/both-client exit
coverage, including target deletion/multiple-device histories. Legacy direct-write
coexistence remains a release gate. D10.3-D10.5 are unchecked; D11 is not started.

At **10:41 UTC**, exact read-only inventory confirmed assigned iOS
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` Shutdown; task Android AVD
`woordenaar_d08_qa_20260921` process absent; all four `woordenaar-d08-qa.ZFsE50`
containers exited. The user reaffirmed task-device QA permission. No device/backend
restart was needed for this synthetic checkpoint; other sessions were not operated
on. Private `.playwright-cli/` and ignored QA roots are retained/uncommitted.
No running or uncertain operation remains after the final checkpoint hooks.

## Reproduction

Node 24.20.0 on PATH; no hosted credentials:

```sh
CI=true npm test -- --no-watch --no-coverage --watchman=false --runInBand --silent --runTestsByPath src/services/__tests__/dictionaryImportRecoverySync.sqlite.test.ts src/services/__tests__/dictionaryImportMetadata.sqlite.test.ts src/db/__tests__/dictionaryImportDeletion.sqlite.test.ts src/db/__tests__/dictionaryImportRepository.sqlite.test.ts src/db/__tests__/dictionaryImportRecovery.sqlite.test.ts src/services/__tests__/dictionaryImportSync.test.ts src/services/__tests__/syncManager.test.ts src/services/__tests__/syncStatusService.test.ts src/hooks/__tests__/useSyncManager.test.ts src/db/__tests__/wordRepository.test.ts
npm run typecheck:test
```

Strict lint covered changed source and tests; hashes are in `D10-source-sha256.json`.
Temporary Jest JSON/logs are diagnostic only and are not required to resume.
