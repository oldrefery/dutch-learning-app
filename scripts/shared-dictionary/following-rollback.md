# Following migration compensation rehearsal

Local administrator tooling for D13A.6.5, outside deployment migrations and mobile
startup. All positive meaning attestations and packets in tests are synthetic.
This is not authority to link real cards, reconcile real device queues, deploy,
publish content, change feature gates or execute a live rollback.

## PostgreSQL

Install the unchanged `rehearsal.sql`, `following-plan.sql` and
`following-apply.sql`, then `following-rollback.sql` only in a disposable fixture.
Use the protected run and its exact immutable reviewed plan hash:

```sql
SELECT dictionary_following_rehearsal.rollback(
  '<run_uuid>', '<plan_sha256>', '<fresh_batch_uuid>', 50
);
```

Default50/max100. Only committed successful apply receipts are selected, ordered
by personal word ID, with receipt `FOR UPDATE SKIP LOCKED`. Each selected live
word/state and its published head/revision/entry are locked and rechecked in the
same transaction. Source fingerprints exclude SRS/word update timestamps; the
receipt's full result fingerprint and original approved head delivery sequence
must match. Later content/reference/placement/state/head changes are terminal
holds. Missing, tombstoned or differently owned rows are unavailable. No row is
inserted or resurrected. Compensating this run's committed receipts does not
cancel other apply work; stop/reconcile outstanding apply workers before live
operation planning. There is no live-operation authorization in this checkpoint.

Restore only dictionary reference/mode and state fallback/overrides. Raw lexical
fields, media, personal IDs/owner/placement, SRS and learning/history/receipt tables
are never restored from a snapshot. Content version increments once, never rewinds.
When the original had no state, create no historical version0: retain the state
installed by apply and give it the protected original effective legacy fallback.
Existing legacy references/fallback/overrides are preserved in the originals and
restored with the new version. BIGINT maximum is a reconciliation hold.

Per-row compensation result snapshots and batch intent/results commit atomically.
Update/delete/truncate of receipts are denied; no receipt FK targets a live word.
A busy row leaves no compensation receipt; use a **new** batch UUID after the
lock releases. An exact retry of a committed batch returns its saved aggregate,
even after later learning/deletion or disabled capabilities. Changed intent fails.
Other skipped rows remain held for reconciliation; do not erase receipts to retry.
Compensation does not enable or depend on feature flags. Schema/function/table
access remains denied to PUBLIC, anon, authenticated and service_role.

## File-backed SQLite

`following-rollback.sqlite.ts` is a disposable operator rehearsal, never imported
by app initialization. Its schema is installed only on fixture databases. It uses
the actual native tables, parsed protocol2 packets and the Expo SQLite transaction
handle, while tests replace only the native bridge with file-backed SQLite.

Prepare an authoritative legacy protocol2 cache first. Protect a canonical exact
source snapshot before apply; learning/sync timestamps and pending learning values
are excluded from content identity. Unreconciled private content commands block
apply; pending private content added afterward causes a rollback hold. Never consume
those commands as a migration side effect. Local apply and its immutable full
original/result snapshots commit together. Targets/revisions and batches are strictly
parsed, revision identity collisions and changed cached heads fail closed.

Compensation requires this owner's matching run receipt plus unchanged personal
content/placement/private state, effective cache and shared head/revision content.
It restores only the effective legacy card cache with version+1 and retains the
current watermark, shared revision/head cache, protected originals, v1 state,
cursors/debt, raw words, SRS, accepted reviews, reset/correction/pending/retry data.
The fixture's private content is retained in the legacy packet and raw originals.
Receipts survive hard deletion. Exact batch retries do not rewind a newer cache.
SQLite competing writers may fail with `database is locked`; the entire transaction
rolls back with no false result/receipt, and the same uncommitted batch can resume.

This local fixture is not a server delivery packet or a client runtime migration.
Real server-to-device restoration must use authoritative version/watermark, current
queues and reviewed mode reconciliation. Device adoption remains D13A.7/8 evidence.

## Verification

```bash
WOORDENAAR_PG_DOCKER=1 node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/dictionary-following-rollback.test.mjs
node scripts/shared-dictionary/following-rollback-bundle.fixture.mjs
```

Run the native Jest file
`apps/mobile/src/db/__tests__/dictionaryFollowingMigrationRollback.sqlite.test.ts`
from the mobile workspace with CI, no watchman and one worker. The TypeScript fixture
compiler uses the installed compiler to emit the real operator and pure local
dependencies into ignored reports. No new dependency is installed. Owned SQLite
worker IPC barriers prove two provisional restorations before an exact owned process
kill; restart and identical intent recover. A competing writer and commit barrier
prove serialized batches/deletion races. PostgreSQL tests use the existing owned
session/backend helpers and observed server locks, never timing guesses.

Fresh final evidence, failures and exact source/report hashes:
[D13A.6.5 evidence](../../docs/tasks/shared-dictionary-cefr/evidence/D13A-following-rollback-20261011.md).
Do not use earlier transaction ROLLBACK or historical full-suite results to claim
this selective compensation gate passed.
