# D10.3 offline import review and preservation repairs

Date: 2026-10-02. User confirmed switching to Astra after checkpoint `18d48b7`;
High effort carries forward from the accepted review routing. Review input is
implementation `dfdc7f0`. Repairs are committed locally as
`5efd6ff093765672e74dc071996b5d866c62a7c6`
(`fix: preserve dictionary imports across sync races`). Existing branch `feature/shared-dictionary-schema`,
AUTH-17 local work and AUTH-18 local commits. No independent agent was used.
D10 remains in progress; D10.3-D10.5 are not closed.

## Reproduced findings and repairs

1. **Acknowledged import identity could be recreated after remote hard-delete.**
   The server correctly replayed its immutable inserted receipt, but the mobile
   client deleted the intent and forgot its origin. Its later metadata path then
   treated a missing row as a new ordinary card. A regression observed the unwanted
   `words.upsert`. SQLite v15 now records owner/personal-ID acknowledgement in the
   same transaction that removes the exact intent. The marker survives restart
   and metadata/content edits. Missing acknowledged IDs stop delivery while local
   content and all queues remain intact; they never enter bootstrap INSERT.
   Failure to persist the marker rolls acknowledgement back. Owner checks and FK
   cleanup apply. Pending v14 imports and older queues survive migration/interruption.
2. **Read-only import still required collection INSERT permission.**
   Even after a successful insert-only word RPC, `pushCollectionsForWords` upserted
   every target, including already synced collections. The real PostgreSQL policy
   rejects `INSERT ... ON CONFLICT` for that existing target. Two orchestration
   regressions failed with a simulated equivalent policy error. Enabled dictionary
   sync now omits already delivered collection rows from that bootstrap write;
   collection creation/unsent metadata still follows the ordinary permission gate.
3. **Remote target deletion silently hid a pending import.**
   Remote-collection reconciliation and subsequent orphan cleanup converted the
   offline word to a tombstone, causing its durable intent to disappear from active
   delivery/status. Both cleanup paths now preserve pending import identities and
   their content/learning queues. Explicit user deletion keeps its existing behavior.
   Missing targets remain a visible delivery failure; this repair does not invent
   a new target or claim that the retargeting UI is complete.
4. **Personal hydration could overwrite a newly queued local operation.**
   `saveWords` checked preservation in SELECT and then updated the row after an
   async gap. A deterministic file-backed SQLite interleaving queued local learning
   immediately before UPDATE: repetition 21/pending became 14/synced before repair.
   UPDATE now atomically rechecks tombstones, pending status and learning/content/
   import queues when preservation is requested. The queued operation and local
   projection survive; the refresh obligation remains pending.
5. **SRS hydration left dictionary content refresh incomplete.**
   Targeted personal pull queued a dictionary refresh after the last dictionary
   stage, then reported completion. The same chunk now hydrates active dictionary
   dependencies before acknowledging personal hydration. Failure/incomplete results
   retain the obligation. Remote tombstones do not request active-card content.
6. **Deleted cards retained an impossible active refresh count.**
   Personal refresh queue reads now exclude tombstoned words, consistent with import
   and content-command reads. Stored debt is retained with the tombstone, but cannot
   prevent active-card synchronization from completing indefinitely.

No server migration or generated contract changed during this review. The SQL
RPC's default-off/auth/target boundaries, immutable hash binding, server SRS
initialization, exact official reference validation and zero-version create/link
ordering retain their previously verified behavior. Additional real lock-barrier
coverage verifies a stable conflict receipt when the existing card is deleted
concurrently. Account-deletion coverage verifies ledger cascade without allowing
ordinary receipt deletion. No personal-ID remapping or implicit learning merge.

## Verification

- Initial regressions: three failed (82 existing passed); two more failed for the
  hydration race/deleted debt (nine existing passed); collection-level refinements
  reproduced read-only INSERT rejection and remote-target cleanup (three failures).
- Final focused mobile: eight suites / 170 tests passed, covering receipt marker
  persistence/rollback/owner scope, v14-to-v15 interrupted upgrade, preservation
  of prior queues, collection cleanup, metadata ordering and hydration interleaving.
- D10 synthetic PostgreSQL: 16/16 passed. This includes the preceding 14 contract
  cases, real read-only collection upsert rejection, concurrent duplicate deletion
  and account ledger cascade. Temporary Unix-socket clusters were cleaned up.
- Mobile test-inclusive typecheck, strict changed-file ESLint with zero warnings,
  scoped formatting and diff checks pass. Ordinary commit hooks passed at
  `5efd6ff`: mobile 147 suites / 1689 tests / 22 snapshots; web 75 suites /
  642 tests, with one pre-existing skipped suite/test. No hook bypass.
- Full PostgreSQL 188/188 remains historical evidence at `dfdc7f0`; it was not
  repeated because server code/schema did not change. The focused SQL file now
  contains two additional passing tests. No new target generation was needed.

Commands used with Node 24.20.0 on PATH:

```sh
CI=true npm test --workspace @woordenaar/mobile -- --watch=false --runInBand --watchman=false --silent --runTestsByPath src/services/__tests__/syncManager.test.ts src/db/__tests__/dictionaryImportRepository.sqlite.test.ts src/db/__tests__/initDB.test.ts src/db/__tests__/initDB.migration.sqlite.test.ts src/db/__tests__/wordRepository.test.ts src/db/__tests__/syncConflicts.sqlite.test.ts src/db/__tests__/officialPackImport.sqlite.test.ts src/db/__tests__/learningCommands.sqlite.test.ts
npm run mobile:typecheck:test
WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/official-dictionary-mapping.test.mjs
```

Strict ESLint and scoped Prettier cover the changed source/test files. The current
[D10 fingerprints](D10-source-sha256.json) identify the final reviewed source.
Temporary logs under `/private/tmp/woordenaar-d10-review-*` are diagnostic copies,
not required to resume. Durable findings and aggregate results are recorded here.

Failed test infrastructure attempts: the first new SQL concurrency fixture tried
to delete an uncommitted INSERT invisible to the second transaction, so no lock
barrier was possible. It now starts with a committed card and overlaps an actual
conflict-row lock with deletion. No timeout was extended. Mock assertions were
updated for the new SQL guard parameter; typed fixture omissions and duplicate
literal lint warnings were corrected. No hook or lint rule was bypassed.

## Remaining D10 scope and next action

Resume implementation on GPT-6.1 Sol / High. The current-thread switching API is
unavailable, and the preceding UI attempt was denied by the computer-use tool;
no automatic picker change is claimed. No need to repeat D08/D09 acceptance.

Complete the integration cases before closing D10.3-D10.5: explicit unavailable-
target/retargeting recovery, background delivery, both-client import/export and
mobile self-contained document reimport, then task-only native validation of the
new path. Active same-semantic-key cards retain separate histories; retry requires
the original server key to become vacant and does not solve simultaneous active
coexistence under the legacy unique index.

Pre-v14 cards have no reliable import-origin record. Likewise v14 acknowledgements
already consumed before this upgrade cannot be reconstructed from absent intents;
this review does not guess their provenance. No v14 native task build was installed.
Safely evidenced pre-upgrade recovery remains a release integration gate.

Retained native/D08 QA stayed off; no other session/device was operated. All new
synthetic test resources were cleaned up. Preserve private `.playwright-cli/` and
ignored QA reports/source copies outside commits. No production, schema cutover,
push/PR/merge, deployment, publication, paid operation or new automation.
